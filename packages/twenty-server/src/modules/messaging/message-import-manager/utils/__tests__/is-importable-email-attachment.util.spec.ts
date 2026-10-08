import { isImportableEmailAttachment } from 'src/modules/messaging/message-import-manager/utils/is-importable-email-attachment.util';

describe('isImportableEmailAttachment', () => {
  it('keeps a named file with content', () => {
    expect(
      isImportableEmailAttachment({
        filename: 'devis.pdf',
        content: Buffer.from('pdf'),
      }),
    ).toBe(true);
  });

  it('drops calendar invites and empty files', () => {
    expect(
      isImportableEmailAttachment({
        filename: 'invite.ics',
        content: Buffer.from('begin'),
      }),
    ).toBe(false);
    expect(
      isImportableEmailAttachment({
        filename: 'devis.pdf',
        content: Buffer.alloc(0),
      }),
    ).toBe(false);
  });
});
