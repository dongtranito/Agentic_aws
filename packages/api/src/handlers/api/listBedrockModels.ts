// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { APIGatewayProxyResult } from 'aws-lambda';
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
 * Lists available models by combining:
 * 1. Foundation models that support ON_DEMAND (direct regional invocation)
 * 2. All active inference profiles (regional and cross-region)
 *
 * This ensures both on-demand models and cross-region profiles (apac.*, us.*, eu.*)
 * appear in the configuration dropdown.
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    const [fmResponse, profilesResponse] = await Promise.all([
      bedrock.send(new ListFoundationModelsCommand({})),
      bedrock.send(new ListInferenceProfilesCommand({})),
    ]);

    const seen = new Set<string>();
    const models: {
      modelId: string;
      modelName: string;
      providerName: string;
    }[] = [];

    // 1. Foundation models available on-demand in this region
    for (const m of fmResponse.modelSummaries ?? []) {
      if (m.modelLifecycle?.status !== 'ACTIVE') continue;
      const inferenceTypes = m.inferenceTypesSupported ?? [];
      if (!inferenceTypes.includes('ON_DEMAND')) continue;

      const modelId = m.modelId ?? '';
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);

      models.push({
        modelId,
        modelName: m.modelName ?? '',
        providerName: m.providerName ?? '',
      });
    }

    // 2. All active inference profiles (regional + cross-region)
    for (const p of profilesResponse.inferenceProfileSummaries ?? []) {
      const profileId = p.inferenceProfileId;
      if (!profileId || p.status !== 'ACTIVE' || seen.has(profileId)) continue;
      seen.add(profileId);

      // Derive provider from profile ID (e.g. "apac.anthropic.claude-..." → "anthropic")
      const parts = profileId.split('.');
      const providerName = parts.length > 1 ? parts[1] : parts[0];

      models.push({
        modelId: profileId,
        modelName: p.inferenceProfileName ?? profileId,
        providerName,
      });
    }

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
