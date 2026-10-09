import { isString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

export const OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START = 100;

const OFFER_NUMBER_SEQUENCE_PATTERN = /^(\d{2})\d{2}-[^-]+-(\d+)$/;

export const readOpportunityOfferNumberSequence = ({
  offerNumber,
  yearPrefix,
}: {
  offerNumber: string;
  yearPrefix: string;
}): number | undefined => {
  const match = OFFER_NUMBER_SEQUENCE_PATTERN.exec(offerNumber.trim());

  if (match?.[1] !== yearPrefix) {
    return undefined;
  }

  const sequence = Number(match[2]);

  return Number.isInteger(sequence) ? sequence : undefined;
};

// 100 is the first offer of the ISO week-year. The next number stays above
// every suffix already used that year, and at least at 100 plus how many
// offer numbers already carry that year's prefix. createdAt is not the year:
// an import stamps every row with the import date.
export const computeOpportunityOfferNumberSequence = ({
  yearlyOpportunityCount,
  offerNumbers,
  yearPrefix,
}: {
  yearlyOpportunityCount: number;
  offerNumbers: readonly string[];
  yearPrefix: string;
}): number => {
  const countBasedSequence =
    OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START +
    Math.max(0, yearlyOpportunityCount);

  const highestExistingSequence = offerNumbers.reduce(
    (highestSequence, offerNumber) => {
      const sequence = readOpportunityOfferNumberSequence({
        offerNumber,
        yearPrefix,
      });

      if (sequence === undefined) {
        return highestSequence;
      }

      return Math.max(highestSequence, sequence);
    },
    OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START - 1,
  );

  return Math.max(countBasedSequence, highestExistingSequence + 1);
};

export const computeOpportunityOfferNumberSequenceFromOpportunities = ({
  opportunities,
  offerNumberFieldName,
  yearPrefix,
}: {
  opportunities: readonly {
    [fieldName: string]: unknown;
  }[];
  offerNumberFieldName: string | undefined;
  yearPrefix: string;
}): number => {
  const offerNumbers = isDefined(offerNumberFieldName)
    ? opportunities.flatMap((opportunity) => {
        const offerNumber = opportunity[offerNumberFieldName];

        return isString(offerNumber) ? [offerNumber] : [];
      })
    : [];
  const yearlyOpportunityCount = offerNumbers.filter(
    (offerNumber) =>
      readOpportunityOfferNumberSequence({ offerNumber, yearPrefix }) !==
      undefined,
  ).length;

  return computeOpportunityOfferNumberSequence({
    yearlyOpportunityCount,
    offerNumbers,
    yearPrefix,
  });
};
