const OPPORTUNITY_OFFER_NUMBER_SEQUENCE_FIELD =
  '  opportunityOfferNumberSequence: Int!';

export const appendOpportunityOfferNumberSequenceToSdl = (
  sdl: string,
): string => {
  if (sdl.includes('opportunityOfferNumberSequence')) {
    return sdl;
  }

  return sdl.replace(
    'type Query {',
    `type Query {\n${OPPORTUNITY_OFFER_NUMBER_SEQUENCE_FIELD}`,
  );
};
