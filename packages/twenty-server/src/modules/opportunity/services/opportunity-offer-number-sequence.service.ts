import { Injectable } from '@nestjs/common';

import { getISOWeekYear } from 'date-fns';
import { isDefined } from 'twenty-shared/utils';

import { findFlatEntityByIdInFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { findOpportunityOfferNumberFieldName } from 'src/modules/match-participant/utils/find-opportunity-offer-number-field-name.util';
import { computeOpportunityOfferNumberSequenceFromOpportunities } from 'src/modules/opportunity/utils/compute-opportunity-offer-number-sequence.util';

const OFFER_NUMBER_FIELD_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

@Injectable()
export class OpportunityOfferNumberSequenceService {
  constructor(private readonly workspaceOrmManager: WorkspaceOrmManager) {}

  async getNextSequence(): Promise<number> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository = this.workspaceOrmManager.getRepository('opportunity', {
        shouldBypassPermissionChecks: true,
      });
      const internalContext = repository.internalContext;
      const opportunityObjectId =
        internalContext.objectIdByNameSingular.opportunity;
      const opportunityObject = findFlatEntityByIdInFlatEntityMapsOrThrow({
        flatEntityId: opportunityObjectId,
        flatEntityMaps: internalContext.flatObjectMetadataMaps,
      });
      const fields = opportunityObject.fieldIds.map((fieldId) =>
        findFlatEntityByIdInFlatEntityMapsOrThrow({
          flatEntityId: fieldId,
          flatEntityMaps: internalContext.flatFieldMetadataMaps,
        }),
      );
      const offerNumberFieldName = findOpportunityOfferNumberFieldName({
        fields,
        opportunityObjectId,
      });
      const selectableFieldName =
        isDefined(offerNumberFieldName) &&
        OFFER_NUMBER_FIELD_NAME_PATTERN.test(offerNumberFieldName)
          ? offerNumberFieldName
          : undefined;
      const yearPrefix = String(getISOWeekYear(new Date()) % 100).padStart(
        2,
        '0',
      );
      const queryBuilder = repository.createQueryBuilder('opportunity');

      queryBuilder.setFindOptions({
        select: {
          id: true,
          ...(isDefined(selectableFieldName)
            ? { [selectableFieldName]: true }
            : {}),
        },
      });
      // Imported opportunities share the import day's createdAt, so the year
      // is the offer-number prefix, not the row timestamp.
      queryBuilder.withDeleted();

      const opportunities = await queryBuilder.getMany<{
        [fieldName: string]: unknown;
      }>();

      return computeOpportunityOfferNumberSequenceFromOpportunities({
        opportunities,
        offerNumberFieldName: selectableFieldName,
        yearPrefix,
      });
    });
  }
}
