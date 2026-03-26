// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';

const ssm = new SSMClient({});

interface AgentSetting {
  agentName: string;
  modelId: string;
  systemPrompt: string;
}

interface SeedData {
  parameterPrefix: string;
  agents: AgentSetting[];
}

export const handler = async (event: CloudFormationCustomResourceEvent) => {
  console.log('Event:', JSON.stringify(event));

  // Only seed on initial stack creation. Updates and deletes are no-ops.
  if (event.RequestType !== 'Create') {
    return { PhysicalResourceId: 'seed-config' };
  }

  const seedData: SeedData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'),
  );

  for (const agent of seedData.agents) {
    const paramName = `${seedData.parameterPrefix}/${agent.agentName}/config`;
    const config = JSON.stringify({
      modelId: agent.modelId,
      systemPrompt: agent.systemPrompt,
    });

    await ssm.send(
      new PutParameterCommand({
        Name: paramName,
        Value: config,
        Type: 'String',
        Overwrite: true,
      }),
    );
    console.log(`Seeded parameter ${paramName}`);
  }

  return { PhysicalResourceId: 'seed-config' };
};
