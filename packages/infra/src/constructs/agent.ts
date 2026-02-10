/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AgentConstruct extends Construct {
  readonly marketer: MarketerAgent;

  constructor(scope: Construct, id: string) {
    super(scope, id);

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

    const marketer = new MarketerAgent(this, 'Marketer', {
      executionRole,
    });

    this.marketer = marketer;
  }
}
