// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { Lazy, Names } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';
import { execSync } from 'child_process';
import * as path from 'path';
import * as url from 'url';
import {
  AgentRuntimeArtifact,
  ProtocolType,
  Runtime,
  RuntimeProps,
} from '@aws-cdk/aws-bedrock-agentcore-alpha';

export type MarketerAgentProps = Omit<
  RuntimeProps,
  'runtimeName' | 'protocolConfiguration' | 'agentRuntimeArtifact'
>;

export class MarketerAgent extends Construct {
  public readonly dockerImage: AgentRuntimeArtifact;
  public readonly agentCoreRuntime: Runtime;

  constructor(scope: Construct, id: string, props?: MarketerAgentProps) {
    super(scope, id);

    this.dockerImage = AgentRuntimeArtifact.fromAsset(
      path.dirname(url.fileURLToPath(new URL(import.meta.url))),
      {
        platform: Platform.LINUX_ARM64,
        extraHash: execSync(
          `docker inspect marketer-agent:latest --format '{{.Id}}'`,
          { encoding: 'utf-8' },
        ).trim(),
      },
    );

    this.agentCoreRuntime = new Runtime(this, 'MarketerAgent', {
      runtimeName: Lazy.string({
        produce: () =>
          Names.uniqueResourceName(this.agentCoreRuntime, { maxLength: 40 }),
      }),
      protocolConfiguration: ProtocolType.HTTP,
      agentRuntimeArtifact: this.dockerImage,
      ...props,
    });
  }
}
