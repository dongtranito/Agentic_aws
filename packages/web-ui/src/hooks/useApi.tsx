import { useContext } from 'react';
import { ApiContext, ApiClient } from '../components/ApiClientProvider';

export const useApi = (): ApiClient => {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi must be used within ApiClientProvider');
  }
  return client;
};
