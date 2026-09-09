// Converts a user-entered folder path into a file:// URL that a browser can
// attempt to open. Handles Windows drive paths (C:\...), UNC shares
// (\\server\share) and POSIX absolute paths (/home/...). Browsers block
// file:// navigation from an http(s) origin, so callers must provide a copy
// fallback; this only builds the best-effort URL.
export const convertFolderPathToFileUrl = (rawPath: string): string => {
  const trimmedPath = rawPath.trim();

  if (/^file:\/\//i.test(trimmedPath)) {
    return encodeURI(trimmedPath);
  }

  // UNC path: \\server\share\folder -> file://server/share/folder
  if (trimmedPath.startsWith('\\\\')) {
    const withoutLeadingSlashes = trimmedPath.slice(2).replace(/\\/g, '/');

    return encodeURI(`file://${withoutLeadingSlashes}`);
  }

  // POSIX absolute path: /home/user/folder -> file:///home/user/folder
  if (trimmedPath.startsWith('/')) {
    return encodeURI(`file://${trimmedPath}`);
  }

  // Windows drive path: C:\Users\me\folder or C:/Users/me/folder
  const normalizedPath = trimmedPath.replace(/\\/g, '/');

  return encodeURI(`file:///${normalizedPath}`);
};
