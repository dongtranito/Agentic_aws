// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { z } from 'zod';

const unixtime = z.number().int().min(0);

export const CampaignOutput = z.object({
  id: z.string(),
  name: z.string(),
});

export type ICampaignOutput = z.TypeOf<typeof CampaignOutput>;

// Get config
// [VI] Lấy cấu hình

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
// [VI] Lấy danh sách chiến dịch

export const GetCampaignsInputSchema = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
  nextToken: z.string().optional(),
});

export type IGetCampaignsInput = z.TypeOf<typeof GetCampaignsInputSchema>;

export const CampaignListItemSchema = CampaignOutput.extend({
  createdAt: unixtime,
  updatedAt: unixtime,
});

export type ICampaignListItem = z.TypeOf<typeof CampaignListItemSchema>;

export const GetCampaignsOutputSchema = z.object({
  campaigns: z.array(CampaignListItemSchema),
  nextToken: z.string().optional(),
});

export type IGetCampaignsOutput = z.TypeOf<typeof GetCampaignsOutputSchema>;

// Create campaign
// [VI] Tạo chiến dịch

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
