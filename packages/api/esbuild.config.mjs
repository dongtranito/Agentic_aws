import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/handlers/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: '../../dist/packages/api/bundle/index.js',
  format: 'cjs',
  external: ['@aws-sdk/*'],
});
