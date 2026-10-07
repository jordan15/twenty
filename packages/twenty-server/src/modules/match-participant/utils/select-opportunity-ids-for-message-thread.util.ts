import { isNonEmptyString } from '@sniptt/guards';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type OpportunitySubjectMatchCandidate = {
  id: string;
  offerNumber: string | null;
};

// Reply and forward prefixes are not part of the offer number the sender typed.
const REPLY_OR_FORWARD_PREFIX = /^(?:re|fwd|fw|tr)\s*:\s*/i;

const normalizeEmailSubject = (subject: string): string => {
  let normalizedSubject = subject.trim();

  while (REPLY_OR_FORWARD_PREFIX.test(normalizedSubject)) {
    normalizedSubject = normalizedSubject
      .replace(REPLY_OR_FORWARD_PREFIX, '')
      .trim();
  }

  return normalizedSubject;
};

const subjectContainsOfferNumber = (
  normalizedSubject: string,
  offerNumber: string,
): boolean => {
  const token = offerNumber.trim();

  if (!isNonEmptyString(token)) {
    return false;
  }

  // A shorter number must not match inside a longer one (OFF-12 inside OFF-123).
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  );

  return pattern.test(normalizedSubject);
};

export const selectOpportunityIdsForMessageThread = ({
  opportunities,
  subjects,
  matchOfferNumberInSubject,
}: {
  opportunities: OpportunitySubjectMatchCandidate[];
  subjects: string[];
  matchOfferNumberInSubject: boolean;
}): string[] => {
  if (!matchOfferNumberInSubject || opportunities.length <= 1) {
    return opportunities.map(({ id }) => id);
  }

  const normalizedSubjects = subjects
    .map(normalizeEmailSubject)
    .filter((subject) => subject.length > 0);

  return opportunities
    .filter(
      ({ offerNumber }) =>
        isNonEmptyString(offerNumber?.trim()) &&
        normalizedSubjects.some((subject) =>
          subjectContainsOfferNumber(subject, offerNumber ?? ''),
        ),
    )
    .map(({ id }) => id);
};
