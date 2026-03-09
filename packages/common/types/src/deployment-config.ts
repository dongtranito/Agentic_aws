/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

export const AdminUserSchema = z.object({
  email: z.email(),
  username: z.string(),
});

export const McpConfigSchema = z.object({
  databricks: z.object({
    token: z.string(),
    url: z.string(),
  }),
  clevertap: z.object({
    projectId: z.string(),
    passcode: z.string(),
    region: z.string(),
  }),
});

export const AgentSettingSchema = z.object({
  agentName: z.string(),
  modelId: z.string().optional().default(''),
  systemPrompt: z.string().optional().default(''),
});

export const DeploymentConfigSchema = z.object({
  adminUser: AdminUserSchema,
  mcp: McpConfigSchema,
  parameterPrefix: z.string().default('/martech/agents'),
  defaultAgentSettings: z.array(AgentSettingSchema).optional().default([]),
});

export type IAdminUser = z.infer<typeof AdminUserSchema>;
export type IMcpConfig = z.infer<typeof McpConfigSchema>;
export type IAgentSetting = z.infer<typeof AgentSettingSchema>;
export type IDeploymentConfig = z.infer<typeof DeploymentConfigSchema>;
