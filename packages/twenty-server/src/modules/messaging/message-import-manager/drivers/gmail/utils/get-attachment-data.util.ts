import { type gmail_v1 as gmailV1 } from 'googleapis';

const isInlinePart = (part: gmailV1.Schema$MessagePart): boolean => {
  const disposition = part.headers?.find(
    (header) => header.name?.toLowerCase() === 'content-disposition',
  )?.value;

  return disposition?.toLowerCase().startsWith('inline') ?? false;
};

const isFilePart = (part: gmailV1.Schema$MessagePart): boolean => {
  const filename = part.filename ?? '';

  return (
    filename.length > 0 &&
    Boolean(part.body?.attachmentId) &&
    !isInlinePart(part)
  );
};

const collectFileParts = (
  parts: gmailV1.Schema$MessagePart[] | undefined,
): gmailV1.Schema$MessagePart[] =>
  (parts ?? []).flatMap((part) => [
    ...(isFilePart(part) ? [part] : []),
    ...collectFileParts(part.parts),
  ]);

export const getAttachmentData = (message: gmailV1.Schema$Message) => {
  return collectFileParts(
    message.payload ? [message.payload] : undefined,
  ).map((part) => ({
    filename: part.filename ?? '',
    id: part.body?.attachmentId ?? '',
    contentType: part.mimeType ?? '',
    size: part.body?.size ?? 0,
  }));
};
