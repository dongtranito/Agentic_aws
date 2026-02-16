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

// Get campaigns (list)

export const GetCampaignsOutputSchema = z.object({
  campaigns: z.array(CampaignOutput),
});

export type IGetCampaignsOutput = z.TypeOf<typeof GetCampaignsOutputSchema>;

// Create campaign

export const CreateCampaignInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export type ICreateCampaignInput = z.TypeOf<typeof CreateCampaignInputSchema>;

export const CreateCampaignOutputSchema = CampaignOutput.extend({
  description: z.string(),
  createdAt: unixtime,
  updatedAt: unixtime,
});

export type ICreateCampaignOutput = z.TypeOf<typeof CreateCampaignOutputSchema>;
