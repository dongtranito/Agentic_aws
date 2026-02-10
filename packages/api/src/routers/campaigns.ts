/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { trpcRouter } from '../init.js';
import { getCampaign } from '../procedures/campaigns.js';

export const campaignsRouter = trpcRouter({
  get: getCampaign,
});
