// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * Shared utilities for AgentCore Gateway MCP Lambda handlers
 */

export interface GatewayClientContext {
  custom?: {
    bedrockAgentCoreToolName?: string;
    bedrockAgentCoreMessageVersion?: string;
    bedrockAgentCoreAwsRequestId?: string;
    bedrockAgentCoreMcpMessageId?: string;
    bedrockAgentCoreGatewayId?: string;
    bedrockAgentCoreTargetId?: string;
  };
}

export interface GatewayContext {
  clientContext?: GatewayClientContext;
}

/**
 * Extracts the tool name from the full Gateway tool name.
 * Gateway format: ${target_name}___${tool_name} (three underscores)
 */
export function extractToolName(fullToolName: string): string {
  const delimiter = '___';
  const idx = fullToolName.indexOf(delimiter);
  return idx >= 0
    ? fullToolName.substring(idx + delimiter.length)
    : fullToolName;
}

const secretsClient = new SecretsManagerClient({});
const secretCache = new Map<string, unknown>();

/**
 * Fetches and caches a JSON secret from Secrets Manager.
 * Results are cached for the lifetime of the Lambda execution context.
 */
export async function getSecret<T>(secretArn: string): Promise<T> {
  const cached = secretCache.get(secretArn);
  if (cached) return cached as T;

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const parsed = JSON.parse(response.SecretString ?? '{}') as T;
  secretCache.set(secretArn, parsed);
  return parsed;
}
