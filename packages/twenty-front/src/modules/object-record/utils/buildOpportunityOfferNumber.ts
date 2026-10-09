import { isString } from '@sniptt/guards';
import {
  endOfISOWeekYear,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeekYear,
} from 'date-fns';
import { CoreObjectNameSingular, FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// Same labels as the server matcher that reads this field from email subjects.
const NORMALIZED_OPPORTUNITY_OFFER_NUMBER_FIELD_LABELS = new Set([
  'noffre',
  'ndoffre',
  'ndeloffre',
  'numerodoffre',
  'numerodeloffre',
  'numerooffre',
]);

export const OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START = 100;

const normalizeFieldLabel = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

export type OpportunityOfferNumberField = {
  id?: string;
  label: string;
  name: string;
  type: string;
  isActive: boolean;
  isUIEditable?: boolean | null;
};

export const findOpportunityOfferNumberField = ({
  fields,
}: {
  fields: ReadonlyArray<OpportunityOfferNumberField | undefined>;
}): OpportunityOfferNumberField | undefined =>
  fields.find(
    (field) =>
      isDefined(field) &&
      field.isActive &&
      field.type === FieldMetadataType.TEXT &&
      NORMALIZED_OPPORTUNITY_OFFER_NUMBER_FIELD_LABELS.has(
        normalizeFieldLabel(field.label),
      ) &&
      field.isUIEditable !== false,
  );

export const includeOpportunityOfferNumberFieldInRecordForm = <
  TField extends OpportunityOfferNumberField & { id: string },
>({
  objectNameSingular,
  fieldMetadataItems,
  recordFormFieldMetadataItems,
}: {
  objectNameSingular: string;
  fieldMetadataItems: readonly TField[];
  recordFormFieldMetadataItems: readonly TField[];
}): TField[] => {
  if (objectNameSingular !== CoreObjectNameSingular.Opportunity) {
    return [...recordFormFieldMetadataItems];
  }

  const offerNumberFieldName = findOpportunityOfferNumberField({
    fields: fieldMetadataItems,
  })?.name;
  const offerNumberField = fieldMetadataItems.find(
    (fieldMetadataItem) => fieldMetadataItem.name === offerNumberFieldName,
  );

  if (
    !isDefined(offerNumberField) ||
    recordFormFieldMetadataItems.some(
      (fieldMetadataItem) => fieldMetadataItem.id === offerNumberField.id,
    )
  ) {
    return [...recordFormFieldMetadataItems];
  }

  return [offerNumberField, ...recordFormFieldMetadataItems];
};

const firstLatinLetter = (value: string): string => {
  const match = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[A-Za-z]/);

  return match?.[0]?.toUpperCase() ?? '';
};

export const buildWorkspaceMemberInitials = (
  name:
    | {
        firstName?: string | null;
        lastName?: string | null;
      }
    | null
    | undefined,
): string | undefined => {
  if (!isDefined(name)) {
    return undefined;
  }

  const firstNameInitial = firstLatinLetter(name.firstName ?? '');
  const lastNameInitial = firstLatinLetter(name.lastName ?? '');
  const initials = `${firstNameInitial}${lastNameInitial}`;

  return initials.length > 0 ? initials : undefined;
};

export const getOpportunityOfferNumberYearBounds = (
  date: Date,
): { gte: string; lte: string } => ({
  gte: startOfISOWeekYear(date).toISOString(),
  lte: endOfISOWeekYear(date).toISOString(),
});

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

// totalCount on an unfiltered findMany is every opportunity ever created.
export const isOpportunityCreatedInIsoWeekYear = ({
  createdAt,
  date,
}: {
  createdAt: unknown;
  date: Date;
}): boolean => {
  const createdAtTime = readCreatedAtTime(createdAt);

  if (!isDefined(createdAtTime)) {
    return false;
  }

  const rangeStart = startOfISOWeekYear(date).getTime();
  const rangeEnd = endOfISOWeekYear(date).getTime();

  return createdAtTime >= rangeStart && createdAtTime <= rangeEnd;
};

export const collectOpportunityOfferNumberSequenceInputs = ({
  opportunities,
  date,
  offerNumberFieldName,
}: {
  opportunities: readonly {
    createdAt?: unknown;
    [fieldName: string]: unknown;
  }[];
  date: Date;
  offerNumberFieldName: string;
}): {
  yearlyOpportunityCount: number;
  existingOfferNumbers: string[];
} => {
  const yearlyOpportunityCount = opportunities.filter((opportunity) =>
    isOpportunityCreatedInIsoWeekYear({
      createdAt: opportunity.createdAt,
      date,
    }),
  ).length;

  return {
    yearlyOpportunityCount,
    existingOfferNumbers: opportunities.flatMap((opportunity) => {
      const offerNumber = opportunity[offerNumberFieldName];

      return isString(offerNumber) ? [offerNumber] : [];
    }),
  };
};

const OFFER_NUMBER_SEQUENCE_PATTERN = /^(\d{2})\d{2}-[^-]+-(\d+)$/;

export const readOpportunityOfferNumberSequence = ({
  offerNumber,
  yearPrefix,
}: {
  offerNumber: string;
  yearPrefix: string;
}): number | undefined => {
  const match = OFFER_NUMBER_SEQUENCE_PATTERN.exec(offerNumber.trim());

  if (!isDefined(match) || match[1] !== yearPrefix) {
    return undefined;
  }

  const sequence = Number(match[2]);

  return Number.isInteger(sequence) ? sequence : undefined;
};

export const computeNextOpportunityOfferSequence = ({
  yearlyOpportunityCount,
  existingOfferNumbers,
  yearPrefix,
}: {
  yearlyOpportunityCount: number;
  existingOfferNumbers: readonly string[];
  yearPrefix: string;
}): number => {
  const countBasedSequence =
    OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START +
    Math.max(0, yearlyOpportunityCount);

  const highestExistingSequence = existingOfferNumbers.reduce(
    (highestSequence, offerNumber) => {
      const sequence = readOpportunityOfferNumberSequence({
        offerNumber,
        yearPrefix,
      });

      if (!isDefined(sequence)) {
        return highestSequence;
      }

      return Math.max(highestSequence, sequence);
    },
    OPPORTUNITY_OFFER_NUMBER_SEQUENCE_START - 1,
  );

  return Math.max(countBasedSequence, highestExistingSequence + 1);
};

// ISO week-year, so YY stays aligned with WW across the new year.
const getOpportunityOfferNumberYearPrefix = (date: Date): string =>
  String(getISOWeekYear(date) % 100).padStart(2, '0');

export const buildOpportunityOfferNumber = ({
  date,
  initials,
  sequence,
}: {
  date: Date;
  initials: string;
  sequence: number;
}): string => {
  const yearPrefix = getOpportunityOfferNumberYearPrefix(date);
  const week = String(getISOWeek(date)).padStart(2, '0');

  return `${yearPrefix}${week}-${initials}-${sequence}`;
};

export const resolveOpportunityOfferNumber = ({
  date,
  initials,
  yearlyOpportunityCount,
  existingOfferNumbers,
}: {
  date: Date;
  initials: string;
  yearlyOpportunityCount: number;
  existingOfferNumbers: readonly string[];
}): string => {
  const yearPrefix = getOpportunityOfferNumberYearPrefix(date);
  let sequence = computeNextOpportunityOfferSequence({
    yearlyOpportunityCount,
    existingOfferNumbers,
    yearPrefix,
  });

  const existingOfferNumberSet = new Set(
    existingOfferNumbers.map((offerNumber) => offerNumber.trim()),
  );

  let offerNumber = buildOpportunityOfferNumber({
    date,
    initials,
    sequence,
  });

  const maxAttempts = existingOfferNumbers.length + 1;
  let attempt = 0;

  while (existingOfferNumberSet.has(offerNumber) && attempt < maxAttempts) {
    sequence += 1;
    offerNumber = buildOpportunityOfferNumber({
      date,
      initials,
      sequence,
    });
    attempt += 1;
  }

  return offerNumber;
};
