// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { IRuntimeConfig } from ':play-c463-z26-rzy-mar-tech/types';
import { Spinner } from '../spinner';
import React, {
  createContext,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';

// Consider specifying types if desired
// [VI] Có thể chỉ định kiểu (type) cụ thể tại đây nếu muốn

/**
 * Context for storing the runtimeConfig.
 *
 * [VI] Context dùng để lưu trữ runtimeConfig (cấu hình chạy thực tế).
 */
export const RuntimeConfigContext = createContext<IRuntimeConfig | undefined>(
  undefined,
);

/**
 * Apply any overrides to point to local servers/resources here
 * for the serve-local target
 *
 * [VI] Áp dụng các ghi đè (override) ở đây để trỏ tới server/tài nguyên cục bộ
 * cho mục tiêu serve-local
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
 *
 * [VI] Thiết lập runtimeConfig.
 *
 * Giả định rằng có một file runtime-config.json nằm tại đường dẫn '/'.
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
