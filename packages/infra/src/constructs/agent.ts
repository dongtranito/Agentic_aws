/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';
import { DatabricksAgentConstruct } from './agents/databricks.js';
import { MarketerAgentConstruct } from './agents/marketer.js';

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

    // Shared memory
    this.memory = new agentcore.Memory(this, 'MarketerMemory', {
      memoryName: 'marketer_memory',
      description: 'Short-term memory for the marketer agent',
    });

    // Deploy individual agents
    const databricks = new DatabricksAgentConstruct(this, 'Databricks', {
      gateway,
    });

    const marketer = new MarketerAgentConstruct(this, 'Marketer', {
      gateway,
      memory: this.memory,
      sessionsBucket,
      databricksRuntime: databricks.agent.agentCoreRuntime,
    });

    this.marketer = marketer.agent;
  }
}
