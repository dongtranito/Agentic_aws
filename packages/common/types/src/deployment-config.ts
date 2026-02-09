/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

export const AdminUserSchema = z.object({
  email: z.email(),
  username: z.string(),
});

export const DeploymentConfigSchema = z.object({
  adminUser: AdminUserSchema,
});
export type IAdminUser = z.infer<typeof AdminUserSchema>;
export type IDeploymentConfig = z.infer<typeof DeploymentConfigSchema>;
