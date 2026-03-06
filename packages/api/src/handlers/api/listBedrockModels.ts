/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from '@aws-sdk/client-bedrock';
import { corsHeaders } from './utils/index.js';

const bedrock = new BedrockClient({});

/**
 * Lambda handler for GET /configuration/models
 *
 * Lists available models by merging foundation models with inference profiles.
 * For each foundation model:
 *  - If it supports ON_DEMAND, return the base model ID (direct regional invocation).
 *  - Otherwise, find a matching inference profile and return that ID instead.
 * Models with no usable ID are excluded.
 */
export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const [fmResponse, ipResponse] = await Promise.all([
      bedrock.send(new ListFoundationModelsCommand({})),
      bedrock.send(new ListInferenceProfilesCommand({})),
    ]);

    // Build a map: base model ID → inference profile ID
    // Each profile's models[] contains ARNs like
    // arn:aws:bedrock:<region>::foundation-model/<modelId>
    const profileByModelId = new Map<string, string>();
    for (const profile of ipResponse.inferenceProfileSummaries ?? []) {
      const profileId = profile.inferenceProfileId;
      if (!profileId || profile.status !== 'ACTIVE') continue;
      for (const m of profile.models ?? []) {
        const arn = m.modelArn ?? '';
        const baseId = arn.split('/').pop();
        if (baseId && !profileByModelId.has(baseId)) {
          profileByModelId.set(baseId, profileId);
        }
      }
    }

    const models = (fmResponse.modelSummaries ?? [])
      .filter((m) => m.modelLifecycle?.status === 'ACTIVE')
      .map((m) => {
        const baseId = m.modelId ?? '';
        const inferenceTypes = m.inferenceTypesSupported ?? [];
        const supportsOnDemand = inferenceTypes.includes('ON_DEMAND');

        // Use the base ID if on-demand is available, otherwise fall back to an inference profile
        const usableId = supportsOnDemand
          ? baseId
          : profileByModelId.get(baseId);

        if (!usableId) return null;

        return {
          modelId: usableId,
          modelName: m.modelName ?? '',
          providerName: m.providerName ?? '',
        };
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ models }),
    };
  } catch (err) {
    console.error('Error listing models:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to list models' }),
    };
  }
};
