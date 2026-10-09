import { TextAreaInput } from '@/ui/field/input/components/TextAreaInput';

import { useTextField } from '@/object-record/record-field/ui/meta-types/hooks/useTextField';

import { FieldInputEventContext } from '@/object-record/record-field/ui/contexts/FieldInputEventContext';
import { RecordFieldComponentInstanceContext } from '@/object-record/record-field/ui/states/contexts/RecordFieldComponentInstanceContext';

import { FieldInputContainer } from '@/ui/field/input/components/FieldInputContainer';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useLingui } from '@lingui/react/macro';
import { type DragEvent, useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components';
import { turnIntoUndefinedIfWhitespacesOnly } from '~/utils/string/turnIntoUndefinedIfWhitespacesOnly';

export const TextFieldInput = () => {
  const { fieldDefinition, draftValue, setDraftValue } = useTextField();

  const { t } = useLingui();
  const { enqueueToast } = useToast();

  const isFolderPath =
    fieldDefinition.metadata.settings?.displayAsFolderPath === true;

  const { onEnter, onEscape, onClickOutside, onTab, onShiftTab } = useContext(
    FieldInputEventContext,
  );

  const instanceId = useAvailableComponentInstanceIdOrThrow(
    RecordFieldComponentInstanceContext,
  );

  const handleEnter = (newText: string) => {
    onEnter?.({ newValue: newText.trim() });
  };

  const handleEscape = (newText: string) => {
    onEscape?.({ newValue: newText.trim() });
  };

  const handleClickOutside = (
    event: MouseEvent | TouchEvent,
    newText: string,
  ) => {
    onClickOutside?.({
      newValue: newText.trim(),
      event,
    });
  };

  const handleTab = (newText: string) => {
    onTab?.({ newValue: newText.trim() });
  };

  const handleShiftTab = (newText: string) => {
    onShiftTab?.({ newValue: newText.trim() });
  };

  const handleChange = (newText: string) => {
    setDraftValue(turnIntoUndefinedIfWhitespacesOnly(newText));
  };

  const handleFolderDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isFolderPath) {
      return;
    }
    event.preventDefault();
  };

  const handleFolderDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFolderPath) {
      return;
    }

    // Browsers never expose the absolute filesystem path of a dropped folder,
    // so we can only prefill the folder name and let the user complete the
    // full path. A dragged text selection (an already-copied path) is used
    // verbatim when present.
    const droppedText = event.dataTransfer.getData('text');
    const droppedEntry =
      event.dataTransfer.items?.[0]?.webkitGetAsEntry?.() ?? null;
    const droppedFileName = event.dataTransfer.files?.[0]?.name;

    if (isDefined(droppedText) && droppedText.trim().length > 0) {
      event.preventDefault();
      setDraftValue(droppedText.trim());

      return;
    }

    const folderName = droppedEntry?.name ?? droppedFileName;

    if (isDefined(folderName) && folderName.length > 0) {
      event.preventDefault();
      setDraftValue(folderName);
      enqueueToast({
        variant: 'info',
        duration: 6000,
        children: t`Only the folder name could be read — browsers don't expose the absolute path. Complete the full path.`,
      });
    }
  };

  return (
    <FieldInputContainer
      onDragOver={handleFolderDragOver}
      onDrop={handleFolderDrop}
    >
      <TextAreaInput
        instanceId={instanceId}
        placeholder={
          isFolderPath
            ? (fieldDefinition.metadata.placeHolder ?? 'C:\\Users\\me\\folder')
            : fieldDefinition.metadata.placeHolder
        }
        autoFocus
        value={draftValue ?? ''}
        onClickOutside={handleClickOutside}
        onEnter={handleEnter}
        onEscape={handleEscape}
        onShiftTab={handleShiftTab}
        onTab={handleTab}
        onChange={handleChange}
      />
    </FieldInputContainer>
  );
};
