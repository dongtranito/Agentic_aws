/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock';
import { corsHeaders } from './utils/index.js';

const bedrock = new BedrockClient({});

/**
 * Lambda handler for GET /configuration/models
 * Lists all available foundation models in the current Bedrock region.
 */
export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const response = await bedrock.send(new ListFoundationModelsCommand({}));

    const models = (response.modelSummaries ?? []).map((m) => ({
      modelId: m.modelId ?? '',
      modelName: m.modelName ?? '',
      providerName: m.providerName ?? '',
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ models }),
    };
  } catch (err) {
    console.error('Error listing Bedrock models:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to list Bedrock models' }),
    };
  }
};
