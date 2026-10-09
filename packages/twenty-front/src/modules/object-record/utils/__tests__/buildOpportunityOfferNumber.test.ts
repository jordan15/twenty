import { CoreObjectNameSingular, FieldMetadataType } from 'twenty-shared/types';

import {
  buildOpportunityOfferNumber,
  buildWorkspaceMemberInitials,
  collectOpportunityOfferNumberSequenceInputs,
  computeNextOpportunityOfferSequence,
  findOpportunityOfferNumberField,
  getOpportunityOfferNumberYearBounds,
  includeOpportunityOfferNumberFieldInRecordForm,
  resolveOpportunityOfferNumber,
} from '@/object-record/utils/buildOpportunityOfferNumber';

describe('findOpportunityOfferNumberField', () => {
  it('finds an active text field labeled N° Offre or Numéro d’offre', () => {
    expect(
      findOpportunityOfferNumberField({
        fields: [
          {
            label: 'N° Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: true,
          },
        ],
      })?.name,
    ).toBe('nOffre');

    expect(
      findOpportunityOfferNumberField({
        fields: [
          {
            label: "Numéro d'offre",
            name: 'numeroDOffre',
            type: FieldMetadataType.TEXT,
            isActive: true,
          },
        ],
      })?.name,
    ).toBe('numeroDOffre');
  });

  it('ignores an inactive field and a field on another type', () => {
    expect(
      findOpportunityOfferNumberField({
        fields: [
          {
            label: 'N° Offre',
            name: 'nOffre',
            type: FieldMetadataType.TEXT,
            isActive: false,
          },
          {
            label: 'N° Offre',
            name: 'nOffreNumber',
            type: FieldMetadataType.NUMBER,
            isActive: true,
          },
          undefined,
        ],
      }),
    ).toBeUndefined();
  });
});

describe('includeOpportunityOfferNumberFieldInRecordForm', () => {
  const offerNumberField = {
    id: 'offer-number-field-id',
    label: "N° d'offre",
    name: 'nDOffre',
    type: FieldMetadataType.TEXT,
    isActive: true,
  };
  const nameField = {
    id: 'name-field-id',
    label: 'Name',
    name: 'name',
    type: FieldMetadataType.TEXT,
    isActive: true,
  };

  it('puts the offer number first when the creation form omits it', () => {
    expect(
      includeOpportunityOfferNumberFieldInRecordForm({
        objectNameSingular: CoreObjectNameSingular.Opportunity,
        fieldMetadataItems: [nameField, offerNumberField],
        recordFormFieldMetadataItems: [nameField],
      }).map((field) => field.name),
    ).toEqual(['nDOffre', 'name']);
  });

  it('leaves another object form unchanged', () => {
    expect(
      includeOpportunityOfferNumberFieldInRecordForm({
        objectNameSingular: CoreObjectNameSingular.Company,
        fieldMetadataItems: [nameField, offerNumberField],
        recordFormFieldMetadataItems: [nameField],
      }),
    ).toEqual([nameField]);
  });
});

describe('buildWorkspaceMemberInitials', () => {
  it('uses the first latin letter of the first and last name', () => {
    expect(
      buildWorkspaceMemberInitials({
        firstName: 'Élodie',
        lastName: 'Martin',
      }),
    ).toBe('EM');
  });

  it('returns undefined when the name has no letters', () => {
    expect(
      buildWorkspaceMemberInitials({ firstName: ' ', lastName: '-' }),
    ).toBeUndefined();
    expect(buildWorkspaceMemberInitials(null)).toBeUndefined();
  });
});

describe('buildOpportunityOfferNumber', () => {
  it('formats the ISO week-year, week, initials and sequence', () => {
    expect(
      buildOpportunityOfferNumber({
        date: new Date(2026, 9, 9),
        initials: 'JG',
        sequence: 100,
      }),
    ).toBe('2641-JG-100');
  });

  it('pads single-digit weeks', () => {
    expect(
      buildOpportunityOfferNumber({
        date: new Date(2026, 0, 1),
        initials: 'PN',
        sequence: 105,
      }),
    ).toBe('2601-PN-105');
  });

  it('uses the ISO week-year at the start of January', () => {
    expect(
      buildOpportunityOfferNumber({
        date: new Date(2027, 0, 1),
        initials: 'PN',
        sequence: 100,
      }),
    ).toBe('2653-PN-100');
  });
});

describe('computeNextOpportunityOfferSequence', () => {
  it('starts at 100 when the year has no opportunities', () => {
    expect(
      computeNextOpportunityOfferSequence({
        yearlyOpportunityCount: 0,
        existingOfferNumbers: [],
        yearPrefix: '26',
      }),
    ).toBe(100);
  });

  it('adds the number of opportunities created this year', () => {
    expect(
      computeNextOpportunityOfferSequence({
        yearlyOpportunityCount: 5,
        existingOfferNumbers: ['2641-JG-100', '2602-PN-104'],
        yearPrefix: '26',
      }),
    ).toBe(105);
  });

  it('continues after a higher existing sequence', () => {
    expect(
      computeNextOpportunityOfferSequence({
        yearlyOpportunityCount: 2,
        existingOfferNumbers: ['2641-JG-100', '2610-PN-108', '2512-AB-900'],
        yearPrefix: '26',
      }),
    ).toBe(109);
  });
});

describe('resolveOpportunityOfferNumber', () => {
  it('proposes the next number for the creator', () => {
    expect(
      resolveOpportunityOfferNumber({
        date: new Date(2026, 9, 9),
        initials: 'JG',
        yearlyOpportunityCount: 3,
        existingOfferNumbers: ['2608-AB-100', '2639-CD-101', '2640-JG-102'],
      }),
    ).toBe('2641-JG-103');
  });
});

describe('collectOpportunityOfferNumberSequenceInputs', () => {
  const date = new Date(2026, 9, 9);

  it('does not count 2025 offer numbers when every row was imported the same day', () => {
    const importedAt = new Date(2026, 9, 9).toISOString();
    const opportunities = [
      ...Array.from({ length: 200 }, (_, index) => ({
        createdAt: importedAt,
        nOffre: `2510-AB-${100 + index}`,
      })),
      ...[
        '2641-YC-272',
        '2641-YC-270',
        '2641-SM-272',
        '2641-SM-271',
        '2640-NF-269',
        '2639-YC-268',
        '2639-SM-267',
        '2641-JG-260',
        '2641-JG-261',
        '2641-JG-262',
        '2541-YC-900',
      ].map((offerNumber) => ({
        createdAt: importedAt,
        nOffre: offerNumber,
      })),
    ];
    const { yearlyOpportunityCount, existingOfferNumbers } =
      collectOpportunityOfferNumberSequenceInputs({
        opportunities,
        date,
        offerNumberFieldName: 'nOffre',
      });

    expect(opportunities).toHaveLength(211);
    expect(yearlyOpportunityCount).toBe(10);
    expect(
      computeNextOpportunityOfferSequence({
        yearlyOpportunityCount,
        existingOfferNumbers,
        yearPrefix: '26',
      }),
    ).toBe(273);
  });

  it('stays at or above 312 when 2641-AO-311 is already used', () => {
    const { yearlyOpportunityCount, existingOfferNumbers } =
      collectOpportunityOfferNumberSequenceInputs({
        opportunities: [
          { createdAt: '2026-10-09T10:00:00.000Z', nOffre: '2541-AB-900' },
          { createdAt: '2026-10-09T10:00:00.000Z', nOffre: '2641-AO-311' },
          {
            createdAt: '2026-10-09T10:00:00.000Z',
            nOffre: '2641-SM-272',
          },
        ],
        date,
        offerNumberFieldName: 'nOffre',
      });

    expect(yearlyOpportunityCount).toBe(2);
    expect(
      computeNextOpportunityOfferSequence({
        yearlyOpportunityCount,
        existingOfferNumbers,
        yearPrefix: '26',
      }),
    ).toBe(312);
  });
});

describe('getOpportunityOfferNumberYearBounds', () => {
  it('covers the ISO week-year, including the boundary weeks', () => {
    const bounds = getOpportunityOfferNumberYearBounds(
      new Date(2026, 9, 9, 15, 30),
    );

    expect(bounds.gte < '2026-01-01').toBe(true);
    expect(bounds.lte > '2026-12-31').toBe(true);
    expect(new Date(2026, 9, 9).toISOString() >= bounds.gte).toBe(true);
    expect(new Date(2026, 9, 9).toISOString() <= bounds.lte).toBe(true);
  });
});
