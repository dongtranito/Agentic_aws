// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { corsHeaders } from './utils/index.js';
import { AgentNameSchema } from '../../schema/configuration.js';

const ssm = new SSMClient({});

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const PARAMETER_PREFIX = process.env.PARAMETER_PREFIX!;

/**
 * Lambda handler for GET /configuration/{agentName}
 * Retrieves the configuration for a specific agent from Parameter Store.
 *
 * [VI] Lambda handler cho GET /configuration/{agentName}
 * Lấy cấu hình của một agent cụ thể từ Parameter Store.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const agentName = event.pathParameters?.agentName;
    const parsed = AgentNameSchema.safeParse(agentName);

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Invalid agent name: ${agentName}` }),
      };
    }

    const paramName = `${PARAMETER_PREFIX}/${parsed.data}/config`;

    try {
      const result = await ssm.send(
        new GetParameterCommand({ Name: paramName }),
      );
      const config = JSON.parse(result.Parameter?.Value ?? '{}');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ agentName: parsed.data, config }),
      };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        err.name === 'ParameterNotFound'
      ) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            agentName: parsed.data,
            config: { modelId: '', systemPrompt: '' },
          }),
        };
      }
      throw err;
    }
  } catch (err) {
    // [VI] Ghi log lỗi khi lấy cấu hình agent
    console.error('Error getting agent config:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to get agent configuration' }),
    };
  }
};
