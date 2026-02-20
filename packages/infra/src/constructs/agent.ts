/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface AgentConstructProps {
  gateway: agentcore.Gateway;
  sessionsBucket: s3.IBucket;
}

export class AgentConstruct extends Construct {
  readonly marketer: MarketerAgent;
  readonly memory: agentcore.Memory;

  constructor(scope: Construct, id: string, props: AgentConstructProps) {
    super(scope, id);

    const { gateway, sessionsBucket } = props;

    // Create AgentCore Memory for short-term memory
    this.memory = new agentcore.Memory(this, 'MarketerMemory', {
      memoryName: 'marketer_memory',
      description: 'Short-term memory for the marketer agent',
    });

    const executionRole = new iam.Role(this, 'MarketerRole', {
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
          ],
        }),
      },
    });

    // Grant the execution role access to memory
    this.memory.grantFullAccess(executionRole);

    // Grant the execution role access to invoke the gateway
    gateway.grantInvoke(executionRole);

    // Grant the execution role access to the sessions bucket for artifacts
    sessionsBucket.grantReadWrite(executionRole);

    const marketer = new MarketerAgent(this, 'Marketer', {
      executionRole,
      environmentVariables: {
        MEMORY_ID: this.memory.memoryId,
        GATEWAY_URL: gateway.gatewayUrl ?? '',
        ARTIFACT_BUCKET: sessionsBucket.bucketName,
      },
    });

    this.marketer = marketer;
  }
}
