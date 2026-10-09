import { appendOpportunityOfferNumberSequenceToSdl } from 'src/engine/api/graphql/workspace-graphql-schema-sdl/utils/append-opportunity-offer-number-sequence-to-sdl.util';

describe('appendOpportunityOfferNumberSequenceToSdl', () => {
  it('adds the workspace-wide sequence query to the root query type', () => {
    const sdl = `type Query {
  opportunities: OpportunityConnection
}`;

    expect(appendOpportunityOfferNumberSequenceToSdl(sdl)).toBe(`type Query {
  opportunityOfferNumberSequence: Int!
  opportunities: OpportunityConnection
}`);
  });

  it('leaves an SDL that already exposes the query unchanged', () => {
    const sdl = `type Query {
  opportunityOfferNumberSequence: Int!
}`;

    expect(appendOpportunityOfferNumberSequenceToSdl(sdl)).toBe(sdl);
  });
});
