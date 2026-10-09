import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type RecordFormField } from '@/object-record/record-form/types/RecordFormField';
import { computeRecordFormFields } from '@/object-record/record-form/utils/computeRecordFormFields';
import { includeOpportunityOfferNumberFieldInRecordForm } from '@/object-record/utils/buildOpportunityOfferNumber';
import { recordFormPageLayoutByObjectMetadataIdFamilySelector } from '@/page-layout/states/selectors/recordFormPageLayoutByObjectMetadataIdFamilySelector';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { isDefined } from 'twenty-shared/utils';

export const useRecordFormFields = ({
  objectMetadataItem,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
}): { recordFormFields: RecordFormField[] } => {
  const recordFormPageLayout = useAtomFamilySelectorValue(
    recordFormPageLayoutByObjectMetadataIdFamilySelector,
    { objectMetadataId: objectMetadataItem.id },
  );

  const recordFormFields = isDefined(recordFormPageLayout)
    ? computeRecordFormFields({
        recordFormPageLayout,
        fieldMetadataItems: objectMetadataItem.fields,
      })
    : [];

  const recordFormFieldById = new Map(
    recordFormFields.map((recordFormField) => [
      recordFormField.fieldMetadataItem.id,
      recordFormField,
    ]),
  );

  const recordFormFieldMetadataItems =
    includeOpportunityOfferNumberFieldInRecordForm({
      objectNameSingular: objectMetadataItem.nameSingular,
      fieldMetadataItems: objectMetadataItem.fields,
      recordFormFieldMetadataItems: recordFormFields.map(
        (recordFormField) => recordFormField.fieldMetadataItem,
      ),
    });

  return {
    recordFormFields: recordFormFieldMetadataItems.map(
      (fieldMetadataItem) =>
        recordFormFieldById.get(fieldMetadataItem.id) ?? {
          fieldMetadataItem,
          widgets: [],
          isVisible: true,
        },
    ),
  };
};
