import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type MouseEvent } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconCopy, IconFolder, IconFolderOpen } from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';

import { convertFolderPathToFileUrl } from '@/object-record/record-field/ui/meta-types/display/utils/convertFolderPathToFileUrl';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
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
  const { copyToClipboard, copyToClipboardWithoutSuccessSnackBar } =
    useCopyToClipboard();
  const { enqueueInfoSnackBar } = useSnackBar();

  const openFolder = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const fileUrl = convertFolderPathToFileUrl(path);
    const openedWindow = window.open(fileUrl, '_blank');

    // Browsers block file:// navigation from an http(s) origin. When the open
    // is refused, copy the path (silently) and show a longer, explanatory
    // message so the user can paste it into their file explorer.
    if (!isDefined(openedWindow)) {
      copyToClipboardWithoutSuccessSnackBar(path);
      enqueueInfoSnackBar({
        message: t`Your browser blocked opening the folder. The path was copied — paste it into your file explorer.`,
        options: { duration: 6000 },
      });

      return;
    }

    enqueueInfoSnackBar({
      message: t`Opening folder… If nothing happens, use Copy — your browser may block local folders.`,
      options: { duration: 4000 },
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
        Icon={IconFolderOpen}
        onClick={openFolder}
        title={t`Open folder`}
        accent="tertiary"
      />
      <LightIconButton
        Icon={IconCopy}
        onClick={copyPath}
        title={t`Copy path`}
        accent="tertiary"
      />
    </StyledContainer>
  );
};
