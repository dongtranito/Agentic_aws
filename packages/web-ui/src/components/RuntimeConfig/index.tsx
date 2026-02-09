import type { IRuntimeConfig } from ':play-c463-z26-rzy-mar-tech/types';
import { Spinner } from '../spinner';
import React, {
  createContext,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';

// Consider specifying types if desired

/**
 * Context for storing the runtimeConfig.
 */
export const RuntimeConfigContext = createContext<IRuntimeConfig | undefined>(
  undefined,
);

/**
 * Apply any overrides to point to local servers/resources here
 * for the serve-local target
 */
const applyOverrides = (runtimeConfig: IRuntimeConfig) => {
  if (import.meta.env.MODE === 'serve-local') {
    runtimeConfig.apis.Api = 'http://localhost:2022/';
  }
  return runtimeConfig;
};

/**
 * Sets up the runtimeConfig.
 *
 * This assumes a runtime-config.json file is present at '/'.
 */
const RuntimeConfigProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [runtimeConfig, setRuntimeConfig] = useState<
    IRuntimeConfig | undefined
  >();
  useEffect(() => {
    (async () => {
      try {
        setRuntimeConfig(
          applyOverrides(await (await fetch('/runtime-config.json')).json()),
        );
      } catch {
        setRuntimeConfig(applyOverrides({ apis: {} } as any));
      }
    })();
  }, [setRuntimeConfig]);

  return runtimeConfig ? (
    <RuntimeConfigContext.Provider value={runtimeConfig}>
      {children}
    </RuntimeConfigContext.Provider>
  ) : (
    <Spinner />
  );
};

export default RuntimeConfigProvider;
