import type {
  ICreateCampaignInput,
  ICreateCampaignOutput,
  IGetCampaignOutput,
  IGetCampaignsInput,
  IGetCampaignsOutput,
  IGetChatHistoryOutput,
  IGetSqlResultOutput,
  IPutChatInput,
} from ':play-c463-z26-rzy-mar-tech/api';
import { createContext, FC, PropsWithChildren, useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';

export interface ApiClient {
  campaign: {
    get: (id: string) => Promise<IGetCampaignOutput>;
    list: (input?: IGetCampaignsInput) => Promise<IGetCampaignsOutput>;
    create: (input: ICreateCampaignInput) => Promise<ICreateCampaignOutput>;
  };
  chat: {
    put: (
      input: IPutChatInput,
      onChunk?: (chunk: string) => void,
    ) => Promise<void>;
    getHistory: (sessionId: string) => Promise<IGetChatHistoryOutput>;
  };
  sqlResult: {
    getUrl: (s3Uri: string) => Promise<string>;
  };
}

export const ApiContext = createContext<ApiClient | null>(null);

export const ApiClientProvider: FC<PropsWithChildren> = ({ children }) => {
  const runtimeConfig = useRuntimeConfig();
  const apiUrl = runtimeConfig.apis.Api.replace(/\/$/, '');
  const auth = useAuth();

  const client = useMemo<ApiClient>(
    () => ({
      campaign: {
        get: async (id: string) => {
          const response = await fetch(`${apiUrl}/campaign/${id}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to get campaign: ${response.statusText}`);
          }
          return response.json();
        },
        list: async (input?: IGetCampaignsInput) => {
          const params = new URLSearchParams();
          if (input?.pageSize) params.set('pageSize', String(input.pageSize));
          if (input?.nextToken) params.set('nextToken', input.nextToken);
          const queryString = params.toString();
          const url = queryString
            ? `${apiUrl}/campaign?${queryString}`
            : `${apiUrl}/campaign`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to get campaigns: ${response.statusText}`);
          }
          return response.json();
        },
        create: async (input: ICreateCampaignInput) => {
          const response = await fetch(`${apiUrl}/campaign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
            body: JSON.stringify(input),
          });
          if (!response.ok) {
            throw new Error(
              `Failed to create campaign: ${response.statusText}`,
            );
          }
          return response.json();
        },
      },
      chat: {
        put: async (
          input: IPutChatInput,
          onChunk?: (chunk: string) => void,
        ) => {
          const response = await fetch(`${apiUrl}/chat`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
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
        getHistory: async (sessionId: string) => {
          const response = await fetch(`${apiUrl}/chat/${sessionId}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
          });
          if (!response.ok) {
            throw new Error(
              `Failed to get chat history: ${response.statusText}`,
            );
          }
          return response.json();
        },
      },
      sqlResult: {
        getUrl: async (s3Uri: string) => {
          // s3://bucket/results/xxx.json → results/xxx.json
          const key = s3Uri.replace(/^s3:\/\/[^/]+\//, '');
          const response = await fetch(`${apiUrl}/sql-result/${key}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${auth.user?.id_token}`,
            },
          });
          if (!response.ok) {
            throw new Error(
              `Failed to get SQL result URL: ${response.statusText}`,
            );
          }
          const data: IGetSqlResultOutput = await response.json();
          return data.url;
        },
      },
    }),
    [apiUrl, auth.user?.id_token],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
};

export default ApiClientProvider;
