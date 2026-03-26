// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { z } from 'zod';

export const AgentNameSchema = z.enum([
  'marketer',
  'databricks',
  'talonone',
  'clevertap',
]);

export type IAgentName = z.TypeOf<typeof AgentNameSchema>;

export const AgentConfigSchema = z.object({
  modelId: z.string(),
  systemPrompt: z.string().optional().default(''),
});

export type IAgentConfig = z.TypeOf<typeof AgentConfigSchema>;

export const PutAgentConfigInputSchema = z.object({
  agentName: AgentNameSchema,
  config: AgentConfigSchema,
});

export type IPutAgentConfigInput = z.TypeOf<typeof PutAgentConfigInputSchema>;

export const GetAgentConfigOutputSchema = z.object({
  agentName: AgentNameSchema,
  config: AgentConfigSchema,
});

export type IGetAgentConfigOutput = z.TypeOf<typeof GetAgentConfigOutputSchema>;

export const ListModelsOutputSchema = z.object({
  models: z.array(
    z.object({
      modelId: z.string(),
      modelName: z.string(),
      providerName: z.string(),
    }),
  ),
});

export type IListModelsOutput = z.TypeOf<typeof ListModelsOutputSchema>;
