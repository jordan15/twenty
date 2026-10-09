import { FieldMetadataType } from 'twenty-shared/types';

import { findOpportunityOfferNumberFieldName } from 'src/modules/match-participant/utils/find-opportunity-offer-number-field-name.util';

const OPPORTUNITY_OBJECT_ID = 'opportunity-object-id';

describe('findOpportunityOfferNumberFieldName', () => {
  it('returns the active text field labeled N° Offre on the opportunity', () => {
    expect(
      findOpportunityOfferNumberFieldName({
        opportunityObjectId: OPPORTUNITY_OBJECT_ID,
        fields: [
          {
            objectMetadataId: OPPORTUNITY_OBJECT_ID,
            label: 'N° Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: true,
          },
        ],
      }),
    ).toBe('nOffre');
  });

  it('accepts another degree-sign character in the label', () => {
    expect(
      findOpportunityOfferNumberFieldName({
        opportunityObjectId: OPPORTUNITY_OBJECT_ID,
        fields: [
          {
            objectMetadataId: OPPORTUNITY_OBJECT_ID,
            label: 'Nº Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: true,
          },
        ],
      }),
    ).toBe('nOffre');
  });

  it('returns undefined when the field is inactive or on another object', () => {
    expect(
      findOpportunityOfferNumberFieldName({
        opportunityObjectId: OPPORTUNITY_OBJECT_ID,
        fields: [
          {
            objectMetadataId: OPPORTUNITY_OBJECT_ID,
            label: 'N° Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: false,
          },
          {
            objectMetadataId: 'company-object-id',
            label: 'N° Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: true,
          },
          undefined,
        ],
      }),
    ).toBeUndefined();
  });
});
