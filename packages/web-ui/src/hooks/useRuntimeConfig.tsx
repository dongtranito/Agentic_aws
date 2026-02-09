import { useContext } from 'react';
import { RuntimeConfigContext } from '../components/RuntimeConfig';
import { IRuntimeConfig } from ':play-c463-z26-rzy-mar-tech/types';

export const useRuntimeConfig = (): IRuntimeConfig => {
  const runtimeConfig = useContext(RuntimeConfigContext);

  if (!runtimeConfig) {
    throw new Error(
      'useRuntimeConfig must be used within a RuntimeConfigProvider',
    );
  }

  return runtimeConfig;
};
