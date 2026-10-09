import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  buildOpportunityOfferNumber,
  buildWorkspaceMemberInitials,
  collectOpportunityOfferNumberSequenceInputs,
  findOpportunityOfferNumberField,
  resolveOpportunityOfferNumber,
} from '@/object-record/utils/buildOpportunityOfferNumber';
import { isNonEmptyString, isString } from '@sniptt/guards';
import gql from 'graphql-tag';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

const OPPORTUNITY_OFFER_NUMBER_SEQUENCE_QUERY = gql`
  query OpportunityOfferNumberSequence {
    opportunityOfferNumberSequence
  }
`;

const MAXIMUM_OFFER_NUMBER_PAGES = 50;

export const useBuildOpportunityOfferNumberRecordInput = ({
  objectMetadataItem,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
}) => {
  const store = useStore();
  const apolloCoreClient = useApolloCoreClient();
  const objectPermissions = useObjectPermissionsForObject(
    objectMetadataItem.id,
  );

  const offerNumberField = findOpportunityOfferNumberField({
    fields: objectMetadataItem.fields,
  });

  const { findManyRecordsQuery } = useFindManyRecordsQuery({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFields: isDefined(offerNumberField)
      ? { id: true, [offerNumberField.name]: true }
      : undefined,
  });

  const buildOpportunityOfferNumberRecordInput = useCallback(
    async (
      recordInput?: Partial<ObjectRecord>,
    ): Promise<Partial<ObjectRecord>> => {
      if (
        objectMetadataItem.nameSingular !==
          CoreObjectNameSingular.Opportunity ||
        !isDefined(offerNumberField) ||
        !objectPermissions.canReadObjectRecords ||
        objectPermissions.restrictedFields[offerNumberField.id ?? '']
          ?.canUpdate === false
      ) {
        return {};
      }

      const currentValue = recordInput?.[offerNumberField.name];

      if (isString(currentValue) && isNonEmptyString(currentValue.trim())) {
        return {};
      }

      const initials = buildWorkspaceMemberInitials(
        store.get(currentWorkspaceMemberState.atom)?.name,
      );

      if (!isDefined(initials)) {
        return {};
      }

      const now = new Date();

      try {
        const sequenceResult = await apolloCoreClient.query<{
          opportunityOfferNumberSequence?: number | null;
        }>({
          query: OPPORTUNITY_OFFER_NUMBER_SEQUENCE_QUERY,
          fetchPolicy: 'network-only',
        });
        const workspaceSequence =
          sequenceResult.data?.opportunityOfferNumberSequence;

        if (
          typeof workspaceSequence === 'number' &&
          Number.isFinite(workspaceSequence)
        ) {
          return {
            [offerNumberField.name]: buildOpportunityOfferNumber({
              date: now,
              initials,
              sequence: workspaceSequence,
            }),
          };
        }
      } catch {
        // The workspace sequence query can be missing on a server that has not
        // reloaded its schema. Fall back to the records this member can read.
      }

      const loadedOpportunities: {
        [fieldName: string]: unknown;
      }[] = [];

      try {
        let lastCursor: string | undefined;
        let page = 0;

        while (page < MAXIMUM_OFFER_NUMBER_PAGES) {
          const result =
            await apolloCoreClient.query<RecordGqlOperationFindManyResult>({
              query: findManyRecordsQuery,
              variables: {
                orderBy: [{ createdAt: 'DescNullsLast' }],
                limit: QUERY_MAX_RECORDS,
                lastCursor,
              },
              fetchPolicy: 'network-only',
            });

          const connection = result.data?.[objectMetadataItem.namePlural];

          loadedOpportunities.push(
            ...(connection?.edges ?? []).map((edge) => ({
              [offerNumberField.name]: edge.node?.[offerNumberField.name],
            })),
          );

          if (
            connection?.pageInfo?.hasNextPage !== true ||
            !isNonEmptyString(connection.pageInfo.endCursor)
          ) {
            break;
          }

          lastCursor = connection.pageInfo.endCursor;
          page += 1;
        }
      } catch {
        // Still propose YYWW-initials-100 when the yearly count cannot be loaded.
      }

      const { yearlyOpportunityCount, existingOfferNumbers } =
        collectOpportunityOfferNumberSequenceInputs({
          opportunities: loadedOpportunities,
          date: now,
          offerNumberFieldName: offerNumberField.name,
        });

      return {
        [offerNumberField.name]: resolveOpportunityOfferNumber({
          date: now,
          initials,
          yearlyOpportunityCount,
          existingOfferNumbers,
        }),
      };
    },
    [
      apolloCoreClient,
      findManyRecordsQuery,
      objectMetadataItem.namePlural,
      objectMetadataItem.nameSingular,
      objectPermissions.canReadObjectRecords,
      objectPermissions.restrictedFields,
      offerNumberField,
      store,
    ],
  );

  return { buildOpportunityOfferNumberRecordInput };
};
