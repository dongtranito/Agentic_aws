import type {
  IGetCampaignOutput,
  IPutChatInput,
} from ':play-c463-z26-rzy-mar-tech/api';
import { createContext, FC, PropsWithChildren, useMemo } from 'react';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { useSigV4 } from '../hooks/useSigV4';

export interface ApiClient {
  campaign: {
    get: (id: string) => Promise<IGetCampaignOutput>;
  };
  chat: {
    put: (
      input: IPutChatInput,
      onChunk?: (chunk: string) => void,
    ) => Promise<void>;
  };
}

export const ApiContext = createContext<ApiClient | null>(null);

export const ApiClientProvider: FC<PropsWithChildren> = ({ children }) => {
  const runtimeConfig = useRuntimeConfig();
  const apiUrl = runtimeConfig.apis.Api.replace(/\/$/, '');
  const sigv4Fetch = useSigV4();

  const client = useMemo<ApiClient>(
    () => ({
      campaign: {
        get: async (id: string) => {
          const response = await sigv4Fetch(`${apiUrl}/campaign/${id}`, {
            method: 'GET',
          });
          if (!response.ok) {
            throw new Error(`Failed to get campaign: ${response.statusText}`);
          }
          return response.json();
        },
      },
      chat: {
        put: async (
          input: IPutChatInput,
          onChunk?: (chunk: string) => void,
        ) => {
          const response = await sigv4Fetch(`${apiUrl}/chat`, {
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
    }),
    [apiUrl, sigv4Fetch],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
};

export default ApiClientProvider;
