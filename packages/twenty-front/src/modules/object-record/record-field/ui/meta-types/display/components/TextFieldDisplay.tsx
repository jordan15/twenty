import { useTextFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useTextFieldDisplay';
import { isFieldText } from '@/object-record/record-field/ui/types/guards/isFieldText';
import { FolderPathDisplay } from '@/ui/field/display/components/FolderPathDisplay';
import { TextDisplay } from '@/ui/field/display/components/TextDisplay/TextDisplay';
import { isNonEmptyString } from '@sniptt/guards';

export const TextFieldDisplay = () => {
  const { fieldValue, fieldDefinition, displayedMaxRows } =
    useTextFieldDisplay();

  const textFieldSettings = isFieldText(fieldDefinition)
    ? fieldDefinition.metadata?.settings
    : undefined;

  if (textFieldSettings?.displayAsFolderPath && isNonEmptyString(fieldValue)) {
    return <FolderPathDisplay path={fieldValue} />;
  }

  const displayedMaxRowsFromSettings = textFieldSettings?.displayedMaxRows;

  const displayMaxRowCalculated = displayedMaxRows
    ? displayedMaxRows
    : displayedMaxRowsFromSettings;

  return (
    <TextDisplay text={fieldValue} displayedMaxRows={displayMaxRowCalculated} />
  );
};
