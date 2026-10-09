import { selectOpportunityIdsForMessageThread } from 'src/modules/match-participant/utils/select-opportunity-ids-for-message-thread.util';

const opportunityA = { id: 'opportunity-a', offerNumber: 'OFF-12' };
const opportunityB = { id: 'opportunity-b', offerNumber: 'OFF-99' };

describe('selectOpportunityIdsForMessageThread', () => {
  it('links nothing when the only opportunity is not cited in the subject', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA],
        subjects: ['Point hebdo'],
      }),
    ).toEqual([]);
  });

  it('links the only opportunity when its offer number is in the subject', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA],
        subjects: ['Devis OFF-12'],
      }),
    ).toEqual(['opportunity-a']);
  });

  it('keeps the opportunity whose offer number is in a reply subject', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['Re: Tr: off-12 — proposition'],
      }),
    ).toEqual(['opportunity-a']);
  });

  it('keeps none when several opportunities exist and no subject cites an offer number', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['Point hebdo'],
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
      }),
    ).toEqual(['opportunity-c']);
  });

  it('keeps every opportunity whose offer number is cited on its own', () => {
    expect(
      selectOpportunityIdsForMessageThread({
        opportunities: [opportunityA, opportunityB],
        subjects: ['OFF-12 et aussi OFF-99'],
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
      }),
    ).toEqual([]);
  });
});
