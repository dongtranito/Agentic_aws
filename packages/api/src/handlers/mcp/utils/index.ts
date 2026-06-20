// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * Shared utilities for AgentCore Gateway MCP Lambda handlers
 *
 * [VI] Các tiện ích dùng chung cho các Lambda handler MCP của AgentCore Gateway
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
 *
 * [VI] Trích xuất tên công cụ từ tên công cụ đầy đủ của Gateway.
 * Định dạng của Gateway: ${target_name}___${tool_name} (ba dấu gạch dưới)
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
 *
 * [VI] Lấy và lưu đệm (cache) một secret dạng JSON từ Secrets Manager.
 * Kết quả được lưu đệm trong suốt vòng đời của ngữ cảnh thực thi Lambda.
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
