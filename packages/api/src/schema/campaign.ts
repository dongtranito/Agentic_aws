/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

const unixtime = z.number().int().min(0);

export const CampaignOutput = z.object({
  id: z.string(),
  name: z.string(),
});

export type ICampaignOutput = z.TypeOf<typeof CampaignOutput>;

// Get config

export const GetCampaignInputSchema = z.object({
  id: z.string(),
});

export type IGetCampaignInput = z.TypeOf<typeof GetCampaignInputSchema>;

export const GetCampaignOutputSchema = CampaignOutput.extend({
  createdAt: unixtime,
  updatedAt: unixtime,
});

export type IGetCampaignOutput = z.TypeOf<typeof GetCampaignOutputSchema>;
