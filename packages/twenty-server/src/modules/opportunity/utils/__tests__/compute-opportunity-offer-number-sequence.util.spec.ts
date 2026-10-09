import { computeOpportunityOfferNumberSequence } from 'src/modules/opportunity/utils/compute-opportunity-offer-number-sequence.util';

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
