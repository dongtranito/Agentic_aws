// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { AwsClient } from 'aws4fetch';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { IGetCampaignOutput } from '../schema/campaign.js';
import type { IPutChatInput } from '../schema/chat.js';

const credentialProvider = fromNodeProviderChain();

const sigv4Fetch = (async (...args) => {
  const client = new AwsClient(await credentialProvider());
  return client.fetch(...args);
}) satisfies AwsClient['fetch'];

export interface ApiClientConfig {
  readonly url: string;
}

export const createApiClient = (config: ApiClientConfig) => {
  const baseUrl = config.url.replace(/\/$/, '');

  return {
    campaign: {
      get: async (id: string): Promise<IGetCampaignOutput> => {
        const response = await sigv4Fetch(`${baseUrl}/campaign/${id}`, {
          method: 'GET',
        });
        if (!response.ok) {
          throw new Error(`Failed to get campaign: ${response.statusText}`);
        }
        return response.json() as Promise<IGetCampaignOutput>;
      },
    },
    chat: {
      put: async (
        input: IPutChatInput,
        onChunk?: (chunk: string) => void,
      ): Promise<void> => {
        const response = await sigv4Fetch(`${baseUrl}/chat`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`Failed to send chat: ${response.statusText}`);
        }
        if (response.body && onChunk) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onChunk(decoder.decode(value, { stream: true }));
          }
        }
      },
    },
  };
};
