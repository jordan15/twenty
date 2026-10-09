import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { MicrosoftOAuth2ClientProvider } from 'src/modules/connected-account/oauth2-client-manager/drivers/microsoft/microsoft-oauth2-client.provider';
import { MAX_IMPORTED_EMAIL_ATTACHMENT_BYTES } from 'src/modules/messaging/message-import-manager/utils/is-importable-email-attachment.util';
import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { type MicrosoftGraphBatchResponse } from 'src/modules/messaging/message-import-manager/drivers/microsoft/services/microsoft-get-messages.interface';
import { type ImportedMessageAttachment } from 'src/modules/messaging/message-import-manager/types/message.type';

@Injectable()
export class MicrosoftFetchByBatchService {
  constructor(
    private readonly microsoftOAuth2ClientProvider: MicrosoftOAuth2ClientProvider,
  ) {}

  async fetchAllByBatches(
    messageIds: string[],
    connectedAccount: Pick<ConnectedAccountEntity, 'id' | 'provider'>,
  ): Promise<{
    messageIdsByBatch: string[][];
    batchResponses: MicrosoftGraphBatchResponse[];
  }> {
    const selectedFields = [
      'id',
      'subject',
      'body',
      'receivedDateTime',
      'internetMessageId',
      'internetMessageHeaders',
      'conversationId',
      'parentFolderId',
      'isDraft',
      'from',
      'replyTo',
      'toRecipients',
      'ccRecipients',
      'bccRecipients',
    ].join(',');

    const batchLimit = 20;
    const batchResponses: MicrosoftGraphBatchResponse[] = [];
    const messageIdsByBatch: string[][] = [];

    const client = await this.microsoftOAuth2ClientProvider.getClient(
      connectedAccount.id,
    );

    for (let i = 0; i < messageIds.length; i += batchLimit) {
      const batchMessageIds = messageIds.slice(i, i + batchLimit);

      messageIdsByBatch.push(batchMessageIds);

      const batchRequests = batchMessageIds.map((messageId, index) => ({
        id: (index + 1).toString(),
        method: 'GET',
        url: `/me/messages/${messageId}?$select=${selectedFields}`,
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
        },
      }));

      const batchResponse = await client
        .api('/$batch')
        .post({ requests: batchRequests });

      batchResponses.push(batchResponse);
    }

    return {
      messageIdsByBatch,
      batchResponses,
    };
  }

  async fetchFileAttachments(
    messageId: string,
    connectedAccount: Pick<ConnectedAccountEntity, 'id' | 'provider'>,
  ): Promise<ImportedMessageAttachment[]> {
    const client = await this.microsoftOAuth2ClientProvider.getClient(
      connectedAccount.id,
    );
    const response = await client
      .api(`/me/messages/${messageId}/attachments`)
      .header('Prefer', 'IdType="ImmutableId"')
      .get();
    const attachments = Array.isArray(response?.value) ? response.value : [];

    return attachments.flatMap(
      (attachment: {
        '@odata.type'?: string;
        isInline?: boolean;
        name?: string;
        contentType?: string;
        contentBytes?: string;
      }) => {
        if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
          return [];
        }

        if (attachment.isInline || !isNonEmptyString(attachment.name)) {
          return [];
        }

        if (attachment.name.toLowerCase().endsWith('.ics')) {
          return [{ filename: attachment.name }];
        }

        if (!isNonEmptyString(attachment.contentBytes)) {
          return [];
        }

        const content = Buffer.from(attachment.contentBytes, 'base64');

        if (
          content.length === 0 ||
          content.length > MAX_IMPORTED_EMAIL_ATTACHMENT_BYTES
        ) {
          return [];
        }

        return [
          {
            filename: attachment.name,
            contentType: attachment.contentType ?? 'application/octet-stream',
            content,
          },
        ];
      },
    );
  }
}
