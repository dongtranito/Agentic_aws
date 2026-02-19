import * as esbuild from 'esbuild';

const handlers = [
  'getCampaign',
  'getCampaigns',
  'createCampaign',
  'putChat',
  'getChatHistory',
];

const mcpHandlers = ['mcp/databricks', 'mcp/clevertap', 'mcp/talonone'];

await Promise.all([
  ...handlers.map((handler) =>
    esbuild.build({
      entryPoints: [`src/handlers/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: `../../dist/packages/api/bundle/${handler}/index.js`,
      format: 'cjs',
      external: ['@aws-sdk/*'],
    }),
  ),
  ...mcpHandlers.map((handler) =>
    esbuild.build({
      entryPoints: [`src/handlers/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: `../../dist/packages/api/bundle/${handler}/index.js`,
      format: 'cjs',
      external: ['@aws-sdk/*'],
    }),
  ),
]);
