import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  buildWorkspaceMemberInitials,
  findOpportunityOfferNumberField,
  getOpportunityOfferNumberYearBounds,
  resolveOpportunityOfferNumber,
} from '@/object-record/utils/buildOpportunityOfferNumber';
import { isNonEmptyString, isString } from '@sniptt/guards';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

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
      const { gte, lte } = getOpportunityOfferNumberYearBounds(now);
      let yearlyOpportunityCount = 0;
      let existingOfferNumbers: string[] = [];

      try {
        const result =
          await apolloCoreClient.query<RecordGqlOperationFindManyResult>({
            query: findManyRecordsQuery,
            variables: {
              filter: {
                createdAt: { gte, lte },
              },
              orderBy: [{ createdAt: 'DescNullsLast' }],
              limit: QUERY_MAX_RECORDS,
            },
            fetchPolicy: 'network-only',
          });

        const connection = result.data?.[objectMetadataItem.namePlural];
        const countedOpportunities = connection?.totalCount;

        if (
          typeof countedOpportunities === 'number' &&
          Number.isFinite(countedOpportunities)
        ) {
          yearlyOpportunityCount = countedOpportunities;
        }

        existingOfferNumbers = (connection?.edges ?? []).flatMap((edge) => {
          const offerNumber = edge.node?.[offerNumberField.name];

          return isString(offerNumber) ? [offerNumber] : [];
        });
      } catch {
        // Still propose YYWW-initials-100 when the yearly count cannot be loaded.
      }

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
