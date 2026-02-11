import { publicProcedure } from '../init.js';
import { getCampaignLambda } from '../lambdas/getCampaign.js';
import {
  GetCampaignInputSchema,
  GetCampaignOutputSchema,
} from '../schema/index.js';

export const getCampaign = publicProcedure
  .input(GetCampaignInputSchema)
  .output(GetCampaignOutputSchema)
  .query(getCampaignLambda);
