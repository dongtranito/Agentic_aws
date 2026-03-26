// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import * as esbuild from 'esbuild';

const apiHandlers = [
  'getCampaign',
  'getCampaigns',
  'createCampaign',
  'putChat',
  'getChatHistory',
  'getSqlResult',
  'listBedrockModels',
  'getAgentConfig',
  'putAgentConfig',
];

const mcpHandlers = ['databricks', 'clevertap', 'talonone'];

await Promise.all([
  ...apiHandlers.map((handler) =>
    esbuild.build({
      entryPoints: [`src/handlers/api/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: `../../dist/packages/api/bundle/api/${handler}/index.js`,
      format: 'cjs',
      external: ['@aws-sdk/*'],
    }),
  ),
  ...mcpHandlers.map((handler) =>
    esbuild.build({
      entryPoints: [`src/handlers/mcp/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: `../../dist/packages/api/bundle/mcp/${handler}/index.js`,
      format: 'cjs',
      external: ['@aws-sdk/*'],
    }),
  ),
]);
