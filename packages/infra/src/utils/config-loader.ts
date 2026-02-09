/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
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
    console.error('Error validating configuration schema. Quitting.');
    throw err;
  }
};
