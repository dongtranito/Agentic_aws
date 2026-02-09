import { useContext } from 'react';
import { ApiTRPCContext } from '../components/ApiClientProvider';

export const useApi = () => {
  const container = useContext(ApiTRPCContext);
  if (!container) {
    throw new Error('useApi must be used within ApiClientProvider');
  }
  return container.optionsProxy;
};

export const useApiClient = () => {
  const container = useContext(ApiTRPCContext);
  if (!container) {
    throw new Error('useApiClient must be used within ApiClientProvider');
  }
  return container.client;
};
