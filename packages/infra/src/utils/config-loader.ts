// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  DeploymentConfigSchema,
  IDeploymentConfig,
} from ':play-c463-z26-rzy-mar-tech/types';
import config from 'config';

export const loadDeploymentConfig = (): IDeploymentConfig => {
  const cfgLoaded = config.get('deploymentConfig');
  try {
    const configValidated = DeploymentConfigSchema.parse(cfgLoaded);
    return configValidated as IDeploymentConfig;
  } catch (err) {
    // [VI] Ghi log lỗi khi xác thực schema cấu hình. Dừng chương trình.
    console.error('Error validating configuration schema. Quitting.');
    throw err;
  }
};
