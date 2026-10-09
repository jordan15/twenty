import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// The workspace disambiguates several deals of the same contact by typing this
// unique opportunity field into the email subject.
const OPPORTUNITY_OFFER_NUMBER_FIELD_LABEL = 'N° Offre';

const normalizeFieldLabel = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const NORMALIZED_OPPORTUNITY_OFFER_NUMBER_FIELD_LABEL = normalizeFieldLabel(
  OPPORTUNITY_OFFER_NUMBER_FIELD_LABEL,
);

type OpportunityOfferNumberField = {
  objectMetadataId: string;
  label: string;
  name: string;
  type: string;
  isActive: boolean;
};

export const findOpportunityOfferNumberFieldName = ({
  fields,
  opportunityObjectId,
}: {
  fields: ReadonlyArray<OpportunityOfferNumberField | undefined>;
  opportunityObjectId: string | undefined;
}): string | undefined => {
  if (!isDefined(opportunityObjectId)) {
    return undefined;
  }

  return fields.find(
    (field) =>
      isDefined(field) &&
      field.objectMetadataId === opportunityObjectId &&
      field.isActive &&
      field.type === FieldMetadataType.TEXT &&
      normalizeFieldLabel(field.label) ===
        NORMALIZED_OPPORTUNITY_OFFER_NUMBER_FIELD_LABEL,
  )?.name;
};
