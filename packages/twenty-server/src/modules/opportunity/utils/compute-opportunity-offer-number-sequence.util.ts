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
// every suffix already used that year, and at least at 100 plus the number
// of opportunities created that year.
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

const readCreatedAtTime = (createdAt: unknown): number | undefined => {
  if (createdAt instanceof Date) {
    const time = createdAt.getTime();

    return Number.isNaN(time) ? undefined : time;
  }

  if (!isString(createdAt) || createdAt.trim().length === 0) {
    return undefined;
  }

  const time = new Date(createdAt).getTime();

  return Number.isNaN(time) ? undefined : time;
};

// An unfiltered read includes other ISO week-years. Only createdAt inside
// this one may advance the chrono; a 2025 row must not.
export const isOpportunityCreatedInInclusiveRange = ({
  createdAt,
  rangeStart,
  rangeEnd,
}: {
  createdAt: unknown;
  rangeStart: Date;
  rangeEnd: Date;
}): boolean => {
  const createdAtTime = readCreatedAtTime(createdAt);

  if (!isDefined(createdAtTime)) {
    return false;
  }

  return (
    createdAtTime >= rangeStart.getTime() &&
    createdAtTime <= rangeEnd.getTime()
  );
};

export const computeOpportunityOfferNumberSequenceFromOpportunities = ({
  opportunities,
  offerNumberFieldName,
  yearPrefix,
  rangeStart,
  rangeEnd,
}: {
  opportunities: readonly {
    createdAt?: unknown;
    [fieldName: string]: unknown;
  }[];
  offerNumberFieldName: string | undefined;
  yearPrefix: string;
  rangeStart: Date;
  rangeEnd: Date;
}): number => {
  const yearlyOpportunityCount = opportunities.filter((opportunity) =>
    isOpportunityCreatedInInclusiveRange({
      createdAt: opportunity.createdAt,
      rangeStart,
      rangeEnd,
    }),
  ).length;
  // Suffixes are not limited to this year's createdAt. A matching year prefix
  // occupies its number; another year prefix does not.
  const offerNumbers = isDefined(offerNumberFieldName)
    ? opportunities.flatMap((opportunity) => {
        const offerNumber = opportunity[offerNumberFieldName];

        return isString(offerNumber) ? [offerNumber] : [];
      })
    : [];

  return computeOpportunityOfferNumberSequence({
    yearlyOpportunityCount,
    offerNumbers,
    yearPrefix,
  });
};
