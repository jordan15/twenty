import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { LessThan, Repository } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { BlocklistRepository } from 'src/modules/blocklist/repositories/blocklist.repository';
import { EmailAliasManagerService } from 'src/modules/connected-account/email-alias-manager/services/email-alias-manager.service';
import { MessageChannelSyncStatusService } from 'src/modules/messaging/common/services/message-channel-sync-status.service';
import {
  MessageImportDriverException,
  MessageImportDriverExceptionCode,
} from 'src/modules/messaging/message-import-manager/drivers/exceptions/message-import-driver.exception';
import { type MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel-message-association.workspace-entity';
import { MessagingGetMessagesService } from 'src/modules/messaging/message-import-manager/services/messaging-get-messages.service';
import { MessagingImportMessageAttachmentsService } from 'src/modules/messaging/message-import-manager/services/messaging-import-message-attachments.service';
import {
  MessageImportExceptionHandlerService,
  MessageImportSyncStep,
} from 'src/modules/messaging/message-import-manager/services/messaging-import-exception-handler.service';
import { MessagingSaveMessagesAndEnqueueContactCreationService } from 'src/modules/messaging/message-import-manager/services/messaging-save-messages-and-enqueue-contact-creation.service';
import { filterEmails } from 'src/modules/messaging/message-import-manager/utils/filter-emails.util';
import { MessagingMonitoringService } from 'src/modules/messaging/monitoring/services/messaging-monitoring.service';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { MessageChannelSyncStage } from 'twenty-shared/types';

@Injectable()
export class MessagingMessagesImportService {
  private readonly logger = new Logger(MessagingMessagesImportService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.ModuleMessaging)
    private readonly cacheStorage: CacheStorageService,
    private readonly messageChannelSyncStatusService: MessageChannelSyncStatusService,
    private readonly saveMessagesAndEnqueueContactCreationService: MessagingSaveMessagesAndEnqueueContactCreationService,
    private readonly importMessageAttachmentsService: MessagingImportMessageAttachmentsService,
    private readonly messagingMonitoringService: MessagingMonitoringService,
    private readonly blocklistRepository: BlocklistRepository,
    private readonly emailAliasManagerService: EmailAliasManagerService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
    private readonly messagingGetMessagesService: MessagingGetMessagesService,
    private readonly messageImportErrorHandlerService: MessageImportExceptionHandlerService,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async processMessageBatchImport(
    messageChannel: MessageChannelEntity,
    connectedAccount: ConnectedAccountEntity,
    workspaceId: string,
    batchSize?: number,
  ) {
    let messageIdsToFetch: string[] = [];

    const messagesGetBatchSize =
      batchSize ??
      this.twentyConfigService.get('MESSAGING_MESSAGES_GET_BATCH_SIZE');

    const authContext = buildSystemAuthContext(workspaceId);

    await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        try {
          if (
            messageChannel.syncStage !==
            MessageChannelSyncStage.MESSAGES_IMPORT_SCHEDULED
          ) {
            return;
          }

          await this.messagingMonitoringService.track({
            eventName: 'messages_import.started',
            workspaceId,
            connectedAccountId: messageChannel.connectedAccountId,
            messageChannelId: messageChannel.id,
          });

          await this.messageChannelSyncStatusService.markAsMessagesImportOngoing(
            [messageChannel.id],
            workspaceId,
          );

          if (!isDefined(connectedAccount.handleAliases)) {
            connectedAccount.handleAliases =
              await this.emailAliasManagerService.refreshHandleAliases(
                connectedAccount,
                workspaceId,
              );
          }

          messageIdsToFetch = await this.cacheStorage.setPop(
            `messages-to-import:${workspaceId}:${messageChannel.id}`,
            messagesGetBatchSize,
          );

          if (!messageIdsToFetch?.length) {
            await this.messageChannelSyncStatusService.markAsMessageSyncCompleted(
              [messageChannel.id],
              workspaceId,
            );

            return await this.trackMessageImportCompleted(
              messageChannel,
              workspaceId,
            );
          }

          const allMessages =
            await this.messagingGetMessagesService.getMessages(
              messageIdsToFetch,
              connectedAccount,
              messageChannel,
            );

          const messageFolders = messageChannel.messageFolders ?? [];
          const foldersWithExternalId = messageFolders.filter(
            (folder): folder is typeof folder & { externalId: string } =>
              isDefined(folder.externalId),
          );

          const folderExternalToInternalMap = new Map<string, string>(
            foldersWithExternalId.map((folder) => [
              folder.externalId,
              folder.id,
            ]),
          );

          for (const message of allMessages) {
            const externalFolderIds = message.messageFolderExternalIds ?? [];

            message.messageFolderIds = externalFolderIds
              .map((externalId) => folderExternalToInternalMap.get(externalId))
              .filter(isDefined);
          }

          const userWorkspace = await this.userWorkspaceRepository.findOne({
            where: {
              id: connectedAccount.userWorkspaceId,
            },
          });

          const workspaceMemberRepository =
            this.workspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );

          const workspaceMember = userWorkspace
            ? await workspaceMemberRepository.findOne({
                where: { userId: userWorkspace.userId },
              })
            : null;

          const blocklist =
            await this.blocklistRepository.getEntriesApplicableToWorkspaceMember(
              {
                workspaceMemberId: workspaceMember?.id ?? null,
                workspaceId,
              },
            );

          if (!isDefined(messageChannel.handle)) {
            throw new MessageImportDriverException(
              'Message channel handle is required',
              MessageImportDriverExceptionCode.CHANNEL_MISCONFIGURED,
            );
          }

          if (!isDefined(connectedAccount.handleAliases)) {
            throw new MessageImportDriverException(
              'Message channel handle is required',
              MessageImportDriverExceptionCode.CHANNEL_MISCONFIGURED,
            );
          }

          const workspace = await this.workspaceRepository.findOne({
            where: { id: workspaceId },
            select: ['id', 'isInternalMessagesImportEnabled'],
          });

          const messagesToSave = filterEmails(
            messageChannel.handle,
            [...connectedAccount.handleAliases],
            allMessages,
            blocklist
              .map((blocklistItem) => blocklistItem.handle)
              .filter(isDefined),
            messageChannel.excludeGroupEmails,
            workspace?.isInternalMessagesImportEnabled ?? false,
          );

          if (messagesToSave.length > 0) {
            await this.saveMessagesAndEnqueueContactCreationService.saveMessagesAndEnqueueContactCreation(
              messagesToSave,
              messageChannel,
              connectedAccount,
              workspaceId,
            );
          }

          if (messageIdsToFetch.length < messagesGetBatchSize) {
            await this.messageChannelSyncStatusService.markAsMessageSyncCompleted(
              [messageChannel.id],
              workspaceId,
            );
          } else {
            await this.messageChannelSyncStatusService.markAsMessagesImportPending(
              [messageChannel.id],
              workspaceId,
            );
          }

          await this.messageChannelRepository.update(
            { id: messageChannel.id, workspaceId },
            {
              throttleFailureCount: 0,
              throttleRetryAfter: null,
              syncStageStartedAt: null,
            },
          );

          return await this.trackMessageImportCompleted(
            messageChannel,
            workspaceId,
          );
        } catch (error) {
          this.logger.error(
            `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Error (${error.code}) importing messages: ${error.message}`,
          );
          await this.cacheStorage.setAdd(
            `messages-to-import:${workspaceId}:${messageChannel.id}`,
            messageIdsToFetch,
          );

          await this.messageImportErrorHandlerService.handleDriverException(
            error,
            MessageImportSyncStep.MESSAGES_IMPORT_ONGOING,
            messageChannel,
            workspaceId,
          );

          return await this.trackMessageImportCompleted(
            messageChannel,
            workspaceId,
          );
        }
      },
      authContext,
      { lite: true },
    );
  }

  // Already stored mails are skipped by incremental sync. Each run copies
  // attachments for the next batch, newest first, until the channel is caught up.
  async importMissingEmailAttachments(
    messageChannel: MessageChannelEntity,
    connectedAccount: ConnectedAccountEntity,
    workspaceId: string,
  ): Promise<void> {
    const batchSize = 40;
    const cursorKey = `email-attachment-backfill:${workspaceId}:${messageChannel.id}`;

    try {
      const authContext = buildSystemAuthContext(workspaceId);

      await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
        const cursor = await this.cacheStorage.get<{
          createdAt: string;
          id: string;
        }>(cursorKey);
        const associationRepository =
          this.workspaceOrmManager.getRepository<MessageChannelMessageAssociationWorkspaceEntity>(
            'messageChannelMessageAssociation',
            { shouldBypassPermissionChecks: true },
          );
        const cursorDate = isDefined(cursor)
          ? new Date(cursor.createdAt)
          : undefined;
        const associations = await associationRepository.find({
          where: isDefined(cursorDate)
            ? [
                {
                  messageChannelId: messageChannel.id,
                  createdAt: LessThan(cursorDate),
                },
                {
                  messageChannelId: messageChannel.id,
                  createdAt: cursorDate,
                  id: LessThan(cursor.id),
                },
              ]
            : { messageChannelId: messageChannel.id },
          select: {
            id: true,
            createdAt: true,
            messageId: true,
            messageExternalId: true,
          },
          order: { createdAt: 'DESC', id: 'DESC' },
          take: batchSize,
        });

        if (associations.length === 0) {
          return;
        }

        const messageIdByExternalId = new Map(
          associations.flatMap((association) =>
            isNonEmptyString(association.messageExternalId)
              ? ([[association.messageExternalId, association.messageId]] as const)
              : [],
          ),
        );
        const externalIds = [...messageIdByExternalId.keys()];
        const messages =
          externalIds.length === 0
            ? []
            : await this.messagingGetMessagesService.getMessages(
                externalIds,
                connectedAccount,
                messageChannel,
              );

        if (externalIds.length > 0 && messages.length === 0) {
          this.logger.warn(
            `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Attachment backfill downloaded no messages, retrying this batch next sync`,
          );

          return;
        }

        await this.importMessageAttachmentsService.importAttachments({
          messages,
          messageIdByExternalId,
          workspaceId,
        });

        const oldestInBatch = associations[associations.length - 1];

        await this.cacheStorage.set(cursorKey, {
          createdAt: new Date(oldestInBatch.createdAt).toISOString(),
          id: oldestInBatch.id,
        });

        this.logger.log(
          `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Imported attachments for ${messages.length} already stored messages`,
        );
      }, authContext);
    } catch (error) {
      this.logger.warn(
        `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Failed to backfill email attachments: ${error}`,
      );
    }
  }

  private async trackMessageImportCompleted(
    messageChannel: MessageChannelEntity,
    workspaceId: string,
  ) {
    await this.messagingMonitoringService.track({
      eventName: 'messages_import.completed',
      workspaceId,
      connectedAccountId: messageChannel.connectedAccountId,
      messageChannelId: messageChannel.id,
    });
  }
}
