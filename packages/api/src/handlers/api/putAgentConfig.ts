// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { corsHeaders } from './utils/index.js';
import { PutAgentConfigInputSchema } from '../../schema/configuration.js';

const ssm = new SSMClient({});

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const PARAMETER_PREFIX = process.env.PARAMETER_PREFIX!;

/**
 * Lambda handler for PUT /configuration/{agentName}
 * Stores the configuration for a specific agent in Parameter Store.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const agentName = event.pathParameters?.agentName;
    const body = event.body ? JSON.parse(event.body) : {};

    const parsed = PutAgentConfigInputSchema.safeParse({
      agentName,
      config: body,
    });

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: parsed.error.message }),
      };
    }

    const paramName = `${PARAMETER_PREFIX}/${parsed.data.agentName}/config`;

    await ssm.send(
      new PutParameterCommand({
        Name: paramName,
        Value: JSON.stringify(parsed.data.config),
        Type: 'String',
        Overwrite: true,
      }),
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        agentName: parsed.data.agentName,
        config: parsed.data.config,
      }),
    };
  } catch (err) {
    console.error('Error putting agent config:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to save agent configuration' }),
    };
  }
};
