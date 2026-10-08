import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldActorSource, FileFolder } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';
import { v4 } from 'uuid';

import { buildFileInfo } from 'src/engine/core-modules/file/utils/build-file-info.utils';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type MessageThreadTargetWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-thread-target.workspace-entity';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import {
  type ImportedMessageAttachment,
  type MessageWithParticipants,
} from 'src/modules/messaging/message-import-manager/types/message.type';
import { isImportableEmailAttachment } from 'src/modules/messaging/message-import-manager/utils/is-importable-email-attachment.util';

type AttachmentTarget = {
  targetPersonId: string | null;
  targetCompanyId: string | null;
  targetOpportunityId: string | null;
};

const attachmentSourceKey = (messageId: string, filename: string): string =>
  `email-message/${messageId}/${filename}`;

const targetKey = (target: AttachmentTarget): string =>
  [
    target.targetPersonId ?? '',
    target.targetCompanyId ?? '',
    target.targetOpportunityId ?? '',
  ].join(':');

@Injectable()
export class MessagingImportMessageAttachmentsService {
  private readonly logger = new Logger(
    MessagingImportMessageAttachmentsService.name,
  );

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async importAttachments({
    messages,
    messageIdByExternalId,
    workspaceId,
  }: {
    messages: MessageWithParticipants[];
    messageIdByExternalId: Map<string, string>;
    workspaceId: string;
  }): Promise<void> {
    const messagesWithFiles = messages.flatMap((message) => {
      const messageId = messageIdByExternalId.get(message.externalId);
      const attachments = message.attachments.filter(
        isImportableEmailAttachment,
      );

      if (!isDefined(messageId) || attachments.length === 0) {
        return [];
      }

      return [{ messageId, attachments }];
    });

    if (messagesWithFiles.length === 0) {
      return;
    }

    try {
      await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
        const messageRepository =
          this.workspaceOrmManager.getRepository<MessageWorkspaceEntity>(
            'message',
            { shouldBypassPermissionChecks: true },
          );
        const targetRepository =
          this.workspaceOrmManager.getRepository<MessageThreadTargetWorkspaceEntity>(
            'messageThreadTarget',
            { shouldBypassPermissionChecks: true },
          );
        const attachmentRepository =
          this.workspaceOrmManager.getRepository<AttachmentWorkspaceEntity>(
            'attachment',
            { shouldBypassPermissionChecks: true },
          );
        const storedMessages = await messageRepository.find({
          where: {
            id: In(messagesWithFiles.map(({ messageId }) => messageId)),
          },
          select: { id: true, messageThreadId: true },
        });
        const threadIdByMessageId = new Map(
          storedMessages.flatMap(({ id, messageThreadId }) =>
            isDefined(messageThreadId) ? [[id, messageThreadId] as const] : [],
          ),
        );
        const threadIds = [...new Set(threadIdByMessageId.values())];

        if (threadIds.length === 0) {
          return;
        }

        const threadTargets = await targetRepository.find({
          where: { messageThreadId: In(threadIds) },
          select: {
            messageThreadId: true,
            targetPersonId: true,
            targetCompanyId: true,
            targetOpportunityId: true,
          },
        });
        const targetsByThreadId = new Map<string, AttachmentTarget[]>();

        for (const target of threadTargets) {
          const links = [
            isDefined(target.targetPersonId)
              ? {
                  targetPersonId: target.targetPersonId,
                  targetCompanyId: null,
                  targetOpportunityId: null,
                }
              : undefined,
            isDefined(target.targetCompanyId)
              ? {
                  targetPersonId: null,
                  targetCompanyId: target.targetCompanyId,
                  targetOpportunityId: null,
                }
              : undefined,
            isDefined(target.targetOpportunityId)
              ? {
                  targetPersonId: null,
                  targetCompanyId: null,
                  targetOpportunityId: target.targetOpportunityId,
                }
              : undefined,
          ].filter(isDefined);
          const existing = targetsByThreadId.get(target.messageThreadId) ?? [];

          targetsByThreadId.set(target.messageThreadId, [
            ...existing,
            ...links,
          ]);
        }

        for (const { messageId, attachments } of messagesWithFiles) {
          const threadId = threadIdByMessageId.get(messageId);
          const targets = isDefined(threadId)
            ? (targetsByThreadId.get(threadId) ?? [])
            : [];

          if (targets.length === 0) {
            continue;
          }

          for (const attachment of attachments) {
            await this.importOneAttachment({
              attachment,
              messageId,
              targets,
              workspaceId,
              attachmentRepository,
            });
          }
        }
      }, buildSystemAuthContext(workspaceId));
    } catch (error) {
      this.logger.warn(
        `Failed to import email attachments for workspace ${workspaceId}: ${error}`,
      );
    }
  }

  private async importOneAttachment({
    attachment,
    messageId,
    targets,
    workspaceId,
    attachmentRepository,
  }: {
    attachment: ImportedMessageAttachment;
    messageId: string;
    targets: AttachmentTarget[];
    workspaceId: string;
    attachmentRepository: WorkspaceRepository<AttachmentWorkspaceEntity>;
  }): Promise<void> {
    const content = attachment.content;

    if (!isDefined(content)) {
      return;
    }

    const sourceKey = attachmentSourceKey(messageId, attachment.filename);

    try {
      const existingAttachments = await attachmentRepository.find({
        where: { fullPath: sourceKey },
        select: {
          targetPersonId: true,
          targetCompanyId: true,
          targetOpportunityId: true,
        },
      });
      const existingTargetKeys = new Set(
        existingAttachments.map((existingAttachment) =>
          targetKey({
            targetPersonId: existingAttachment.targetPersonId,
            targetCompanyId: existingAttachment.targetCompanyId,
            targetOpportunityId: existingAttachment.targetOpportunityId,
          }),
        ),
      );
      const missingTargets = [
        ...new Map(
          targets
            .filter((target) => !existingTargetKeys.has(targetKey(target)))
            .map((target) => [targetKey(target), target] as const),
        ).values(),
      ];

      if (missingTargets.length === 0) {
        return;
      }

      const { ext } = buildFileInfo(attachment.filename);
      const extension = isNonEmptyString(ext) ? ext.toLowerCase() : 'bin';
      const fileId = v4();
      const fieldUniversalIdentifier =
        STANDARD_OBJECTS.attachment.fields.file.universalIdentifier;

      await this.fileStorageService.writeFile({
        sourceFile: content,
        fileFolder: FileFolder.FilesField,
        applicationUniversalIdentifier:
          TWENTY_STANDARD_APPLICATION.universalIdentifier,
        workspaceId,
        resourcePath: `${fieldUniversalIdentifier}/${fileId}.${extension}`,
        fileId,
        settings: {
          isTemporaryFile: false,
          toDelete: false,
        },
      });

      await attachmentRepository.insert(
        missingTargets.map((target) => ({
          name: attachment.filename,
          fullPath: sourceKey,
          fileCategory: 'OTHER',
          createdBy: {
            source: FieldActorSource.SYSTEM,
            name: 'System',
            workspaceMemberId: null,
          },
          file: [
            {
              fileId,
              label: attachment.filename,
              extension,
            },
          ],
          ...target,
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Skipped email attachment ${attachment.filename} on message ${messageId}: ${error}`,
      );
    }
  }
}
