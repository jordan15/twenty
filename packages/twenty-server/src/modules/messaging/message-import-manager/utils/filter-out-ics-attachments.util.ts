import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';

export const filterOutIcsAttachments = (
  messages: MessageWithParticipants[],
) => {
  return messages.filter((message) => {
    const attachments = message.attachments ?? [];

    if (attachments.length === 0) {
      return true;
    }

    // A calendar invite has only .ics files. A mail that also carries a real file is kept.
    return attachments.some(
      (attachment) => !attachment.filename.toLowerCase().endsWith('.ics'),
    );
  });
};
