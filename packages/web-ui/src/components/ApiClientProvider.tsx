import { AppRouter } from ':play-c463-z26-rzy-mar-tech/api';
import { useQueryClient } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { createContext, FC, PropsWithChildren, useMemo } from 'react';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import {
  HTTPLinkOptions,
  TRPCClient,
  createTRPCClient,
  httpLink,
} from '@trpc/client';
import { useSigV4 } from '../hooks/useSigV4';

interface ApiTRPCContextValue {
  optionsProxy: ReturnType<typeof createTRPCOptionsProxy<AppRouter>>;
  client: TRPCClient<AppRouter>;
}

export const ApiTRPCContext = createContext<ApiTRPCContextValue | null>(null);

export const ApiClientProvider: FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const runtimeConfig = useRuntimeConfig();
  const apiUrl = runtimeConfig.apis.Api;
  const sigv4Client = useSigV4();

  const container = useMemo<ApiTRPCContextValue>(() => {
    const linkOptions: HTTPLinkOptions<any> = {
      url: apiUrl,
      fetch: sigv4Client,
    };

    const client = createTRPCClient<AppRouter>({
      links: [httpLink(linkOptions)],
    });

    const optionsProxy = createTRPCOptionsProxy<AppRouter>({
      client,
      queryClient,
    });

    return { optionsProxy, client };
  }, [apiUrl, queryClient, sigv4Client]);

  return (
    <ApiTRPCContext.Provider value={container}>
      {children}
    </ApiTRPCContext.Provider>
  );
};

export default ApiClientProvider;
