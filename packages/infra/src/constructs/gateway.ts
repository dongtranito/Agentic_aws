/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';
import * as url from 'url';
import * as path from 'path';
import { IMcpConfig } from ':play-c463-z26-rzy-mar-tech/types';
import { DatabricksTarget } from './gateway/databricks.js';
import { ClevertapTarget } from './gateway/clevertap.js';
import { TalonOneTarget } from './gateway/talonone.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export interface GatewayConstructProps {
  mcpConfig: IMcpConfig;
}

export class GatewayConstruct extends Construct {
  readonly gateway: agentcore.Gateway;
  readonly databricks: DatabricksTarget;
  readonly clevertap: ClevertapTarget;
  readonly talonOne: TalonOneTarget;

  constructor(scope: Construct, id: string, props: GatewayConstructProps) {
    super(scope, id);

    const { mcpConfig } = props;

    const bundlePath = path.resolve(
      __dirname,
      '../../../../dist/packages/api/bundle',
    );

    this.gateway = new agentcore.Gateway(this, 'McpGateway', {
      gatewayName: 'marketer-gateway',
      description:
        'MCP Gateway for marketing tools (Databricks, CleverTap, TalonOne)',
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingAwsIam(),
    });

    this.databricks = new DatabricksTarget(this, 'Databricks', {
      gateway: this.gateway,
      bundlePath,
      databricksUrl: mcpConfig.databricks.url,
      databricksToken: mcpConfig.databricks.token,
    });

    this.clevertap = new ClevertapTarget(this, 'Clevertap', {
      gateway: this.gateway,
      bundlePath,
    });

    this.talonOne = new TalonOneTarget(this, 'TalonOne', {
      gateway: this.gateway,
      bundlePath,
    });
  }
}
