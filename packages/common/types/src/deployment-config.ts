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

export const DeploymentConfigSchema = z.object({
  adminUser: AdminUserSchema,
  mcp: McpConfigSchema,
  parameterPrefix: z.string().default('/martech/agents'),
});
export type IAdminUser = z.infer<typeof AdminUserSchema>;
export type IMcpConfig = z.infer<typeof McpConfigSchema>;
export type IDeploymentConfig = z.infer<typeof DeploymentConfigSchema>;
