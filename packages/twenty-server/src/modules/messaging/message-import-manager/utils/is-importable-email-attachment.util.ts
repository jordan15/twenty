import { isNonEmptyString } from '@sniptt/guards';

import { type ImportedMessageAttachment } from 'src/modules/messaging/message-import-manager/types/message.type';

// Signature images and calendar invites are not files the user expects on a record.
export const MAX_IMPORTED_EMAIL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const isImportableEmailAttachment = (
  attachment: ImportedMessageAttachment,
): boolean => {
  if (!isNonEmptyString(attachment.filename.trim())) {
    return false;
  }

  if (attachment.filename.toLowerCase().endsWith('.ics')) {
    return false;
  }

  const size = attachment.content?.length ?? 0;

  return size > 0 && size <= MAX_IMPORTED_EMAIL_ATTACHMENT_BYTES;
};
