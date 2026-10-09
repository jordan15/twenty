import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type MouseEvent } from 'react';
import { LightIconButton, useToast } from 'twenty-ui/components';
import { IconCopy, IconFolder, IconFolderOpen } from 'twenty-ui/icon';

import { buildOpenFolderProtocolUrl } from '@/object-record/record-field/ui/meta-types/display/utils/buildOpenFolderProtocolUrl';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const StyledContainer = styled.div`
  align-items: center;
  display: inline-flex;
  gap: var(--t-spacing-1);
  max-width: 100%;
  overflow: hidden;
`;

const StyledPathChip = styled.button`
  align-items: center;
  background-color: var(--t-background-transparent-lighter);
  border: 1px solid var(--t-border-color-strong);
  border-radius: var(--t-border-radius-pill);
  box-sizing: border-box;
  color: var(--t-font-color-primary);
  cursor: pointer;
  display: inline-flex;
  gap: var(--t-spacing-1);
  max-width: 100%;
  overflow: hidden;
  padding: var(--t-spacing-1) var(--t-spacing-2);

  &:hover {
    background-color: var(--t-background-transparent-light);
  }
`;

const StyledPathLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type FolderPathDisplayProps = {
  path: string;
};

export const FolderPathDisplay = ({ path }: FolderPathDisplayProps) => {
  const { t } = useLingui();
  const { copyToClipboard } = useCopyToClipboard();
  const { enqueueToast } = useToast();

  const openFolder = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const protocolUrl = buildOpenFolderProtocolUrl(path);

    // file:// is blocked from an https origin, so we trigger a custom protocol
    // (see packages/twenty-docker/windows-open-folder) through a transient
    // hidden iframe. Using an iframe keeps the SPA from navigating away when
    // the OS helper is not installed on this machine.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = protocolUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.remove();
    }, 1000);

    enqueueToast({
      variant: 'info',
      duration: 6000,
      children: t`Opening folder… If nothing happens, the folder helper isn't installed on this computer — use Copy and paste the path into your file explorer.`,
    });
  };

  const copyPath = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    copyToClipboard(path, t`Folder path copied to clipboard`);
  };

  return (
    <StyledContainer>
      <StyledPathChip onClick={openFolder} title={t`Open folder: ${path}`}>
        <IconFolder size={14} />
        <StyledPathLabel>{path}</StyledPathLabel>
      </StyledPathChip>
      <LightIconButton
        aria-label={t`Open folder`}
        tooltip={t`Open folder`}
        emphasis="subtle"
        onClick={openFolder}
      >
        <IconFolderOpen />
      </LightIconButton>
      <LightIconButton
        aria-label={t`Copy path`}
        tooltip={t`Copy path`}
        emphasis="subtle"
        onClick={copyPath}
      >
        <IconCopy />
      </LightIconButton>
    </StyledContainer>
  );
};
