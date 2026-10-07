import { selectOpportunityIdsForMessageThread } from 'src/modules/match-participant/utils/select-opportunity-ids-for-message-thread.util';

const opportunityA = { id: 'opportunity-a', offerNumber: 'OFF-12' };
const opportunityB = { id: 'opportunity-b', offerNumber: 'OFF-99' };

describe('selectOpportunityIdsForMessageThread', () => {
  it('keeps the only opportunity when the subject does not contain its offer number', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA],
        subjects: ['Point hebdo'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual(['opportunity-a']);
  });

  it('keeps every opportunity when offer-number matching is off', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['Point hebdo'],
        matchOfferNumberInSubject: false,
      }),
    ).toEqual(['opportunity-a', 'opportunity-b']);
  });

  it('keeps the opportunity whose offer number is in a reply subject', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['Re: Tr: off-12 — proposition'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual(['opportunity-a']);
  });

  it('keeps none when several opportunities exist and no subject cites an offer number', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['Point hebdo'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual([]);
  });

  it('does not match a shorter offer number inside a longer one', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [
          opportunityA,
          { id: 'opportunity-c', offerNumber: 'OFF-123' },
        ],
        subjects: ['Devis OFF-123'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual(['opportunity-c']);
  });

  it('keeps every opportunity whose offer number is cited on its own', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['OFF-12 et aussi OFF-99'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual(['opportunity-a', 'opportunity-b']);
  });

  it('ignores an empty offer number when several opportunities exist', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [
          opportunityA,
          { id: 'opportunity-d', offerNumber: '   ' },
        ],
        subjects: ['Sans numero'],
        matchOfferNumberInSubject: true,
      }),
    ).toEqual([]);
  });
});
