// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';
import { ClevertapAgentConstruct } from './agents/clevertap.js';
import { DatabricksAgentConstruct } from './agents/databricks.js';
import { MarketerAgentConstruct } from './agents/marketer.js';
import { TalononeAgentConstruct } from './agents/talonone.js';

export interface AgentConstructProps {
  gateway: agentcore.Gateway;
  sessionsBucket: s3.IBucket;
  parameterPrefix: string;
}

export class AgentConstruct extends Construct {
  readonly marketer: MarketerAgent;
  readonly memory: agentcore.Memory;

  constructor(scope: Construct, id: string, props: AgentConstructProps) {
    super(scope, id);

    const { gateway, sessionsBucket, parameterPrefix } = props;

    // Shared memory
    this.memory = new agentcore.Memory(this, 'MarketerMemory', {
      memoryName: 'marketer_memory',
      description: 'Short-term memory for the marketer agent',
    });

    // Deploy individual agents
    const databricks = new DatabricksAgentConstruct(this, 'Databricks', {
      gateway,
      parameterPrefix,
      sessionsBucket,
    });

    const clevertap = new ClevertapAgentConstruct(this, 'Clevertap', {
      gateway,
      parameterPrefix,
      sessionsBucket,
    });

    const talonone = new TalononeAgentConstruct(this, 'Talonone', {
      gateway,
      parameterPrefix,
      sessionsBucket,
    });

    const marketer = new MarketerAgentConstruct(this, 'Marketer', {
      gateway,
      memory: this.memory,
      sessionsBucket,
      parameterPrefix,
      databricksRuntime: databricks.agent.agentCoreRuntime,
      clevertapRuntime: clevertap.agent.agentCoreRuntime,
      talononeRuntime: talonone.agent.agentCoreRuntime,
    });

    this.marketer = marketer.agent;
  }
}
