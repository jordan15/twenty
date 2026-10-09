// Custom URL scheme handled by the optional Windows helper documented in
// packages/twenty-docker/windows-open-folder. Browsers cannot open a local
// folder from an https page via file://, so a registered custom protocol
// forwards the path to the OS file explorer. When the helper is not installed
// on the machine nothing happens, so callers must keep a copy-to-clipboard
// fallback available.
export const OPEN_FOLDER_PROTOCOL = 'openfoldercrm';

export const buildOpenFolderProtocolUrl = (rawPath: string): string => {
  const trimmedPath = rawPath.trim();

  return `${OPEN_FOLDER_PROTOCOL}://${encodeURIComponent(trimmedPath)}`;
};
