import {
  OPEN_FOLDER_PROTOCOL,
  buildOpenFolderProtocolUrl,
} from '@/object-record/record-field/ui/meta-types/display/utils/buildOpenFolderProtocolUrl';

describe('buildOpenFolderProtocolUrl', () => {
  it('encodes a Windows drive path behind the custom protocol', () => {
    expect(buildOpenFolderProtocolUrl('C:\\Projets\\Client')).toBe(
      `${OPEN_FOLDER_PROTOCOL}://C%3A%5CProjets%5CClient`,
    );
  });

  it('encodes a UNC share path', () => {
    expect(buildOpenFolderProtocolUrl('\\\\server\\share\\folder')).toBe(
      `${OPEN_FOLDER_PROTOCOL}://%5C%5Cserver%5Cshare%5Cfolder`,
    );
  });

  it('encodes spaces and a POSIX path', () => {
    expect(buildOpenFolderProtocolUrl('/home/me/my folder')).toBe(
      `${OPEN_FOLDER_PROTOCOL}://%2Fhome%2Fme%2Fmy%20folder`,
    );
  });

  it('trims surrounding whitespace before encoding', () => {
    expect(buildOpenFolderProtocolUrl('  C:\\Temp  ')).toBe(
      `${OPEN_FOLDER_PROTOCOL}://C%3A%5CTemp`,
    );
  });
});
