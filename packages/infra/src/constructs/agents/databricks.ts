// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { DatabricksAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Stack } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface DatabricksAgentConstructProps {
  gateway: agentcore.Gateway;
  parameterPrefix: string;
  sessionsBucket: s3.IBucket;
}

export class DatabricksAgentConstruct extends Construct {
  readonly agent: DatabricksAgent;
  readonly executionRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: DatabricksAgentConstructProps,
  ) {
    super(scope, id);

    const { gateway, parameterPrefix, sessionsBucket } = props;

    this.executionRole = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:Converse',
                'bedrock:ConverseStream',
              ],
              resources: ['*'],
              effect: iam.Effect.ALLOW,
            }),
            new iam.PolicyStatement({
              actions: ['ssm:GetParameter'],
              resources: [
                `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter${parameterPrefix}/*`,
              ],
              effect: iam.Effect.ALLOW,
            }),
          ],
        }),
      },
    });

    gateway.grantInvoke(this.executionRole);
    sessionsBucket.grantReadWrite(this.executionRole);

    this.agent = new DatabricksAgent(this, 'Agent', {
      executionRole: this.executionRole,
      environmentVariables: {
        GATEWAY_URL: gateway.gatewayUrl ?? '',
        AGENT_CONFIG_PARAMETER: `${parameterPrefix}/databricks/config`,
        ARTIFACT_BUCKET: sessionsBucket.bucketName,
      },
    });
  }
}
