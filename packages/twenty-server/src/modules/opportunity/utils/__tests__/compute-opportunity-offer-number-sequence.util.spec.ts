import { endOfISOWeekYear, startOfISOWeekYear } from 'date-fns';

import {
  computeOpportunityOfferNumberSequence,
  computeOpportunityOfferNumberSequenceFromOpportunities,
} from 'src/modules/opportunity/utils/compute-opportunity-offer-number-sequence.util';

describe('computeOpportunityOfferNumberSequence', () => {
  it('starts at 100 when the year has no opportunities', () => {
    expect(
      computeOpportunityOfferNumberSequence({
        yearlyOpportunityCount: 0,
        offerNumbers: [],
        yearPrefix: '26',
      }),
    ).toBe(100);
  });

  it('continues after the highest number already used this year', () => {
    expect(
      computeOpportunityOfferNumberSequence({
        yearlyOpportunityCount: 0,
        offerNumbers: ['2641-JG-270', '2602-PN-104'],
        yearPrefix: '26',
      }),
    ).toBe(271);
  });

  it('counts every opportunity created this year, whoever created it', () => {
    expect(
      computeOpportunityOfferNumberSequence({
        yearlyOpportunityCount: 171,
        offerNumbers: ['2641-JG-270'],
        yearPrefix: '26',
      }),
    ).toBe(271);
  });

  it('ignores numbers from another year', () => {
    expect(
      computeOpportunityOfferNumberSequence({
        yearlyOpportunityCount: 2,
        offerNumbers: ['2541-JG-270', '2601-PN-100'],
        yearPrefix: '26',
      }),
    ).toBe(102);
  });
});

describe('computeOpportunityOfferNumberSequenceFromOpportunities', () => {
  const now = new Date(2026, 9, 9);
  const rangeStart = startOfISOWeekYear(now);
  const rangeEnd = endOfISOWeekYear(now);
  const createdIn2025 = new Date(2025, 5, 1);
  const createdIn2026 = new Date(2026, 9, 1);

  const buildOpportunities = (
    offerNumbersThisYear: readonly string[],
  ): { createdAt: Date; nOffre: string }[] => [
    ...Array.from({ length: 200 }, (_, index) => ({
      createdAt: createdIn2025,
      nOffre: `2510-AB-${100 + index}`,
    })),
    ...offerNumbersThisYear.map((offerNumber) => ({
      createdAt: createdIn2026,
      nOffre: offerNumber,
    })),
  ];

  it('does not turn an all-time count of 211 into a suffix of 311', () => {
    const opportunities = buildOpportunities([
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
    ]);

    expect(opportunities).toHaveLength(211);
    expect(
      computeOpportunityOfferNumberSequenceFromOpportunities({
        opportunities,
        offerNumberFieldName: 'nOffre',
        yearPrefix: '26',
        rangeStart,
        rangeEnd,
      }),
    ).toBe(273);
  });

  it('stays above a same-year suffix of 311', () => {
    expect(
      computeOpportunityOfferNumberSequenceFromOpportunities({
        opportunities: buildOpportunities([
          '2641-YC-272',
          '2641-AO-311',
          '2541-YC-900',
        ]),
        offerNumberFieldName: 'nOffre',
        yearPrefix: '26',
        rangeStart,
        rangeEnd,
      }),
    ).toBe(312);
  });

  it('ignores a 2025 prefix and still respects a 26 prefix on an older row', () => {
    expect(
      computeOpportunityOfferNumberSequenceFromOpportunities({
        opportunities: [{ createdAt: createdIn2025, nOffre: '2541-AB-900' }],
        offerNumberFieldName: 'nOffre',
        yearPrefix: '26',
        rangeStart,
        rangeEnd,
      }),
    ).toBe(100);

    expect(
      computeOpportunityOfferNumberSequenceFromOpportunities({
        opportunities: [{ createdAt: createdIn2025, nOffre: '2641-AO-311' }],
        offerNumberFieldName: 'nOffre',
        yearPrefix: '26',
        rangeStart,
        rangeEnd,
      }),
    ).toBe(312);
  });
});
