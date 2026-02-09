import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    tsconfig: 'tsconfig.lib.json',
    input: 'src/router.ts',
    output: {
      file: '../../dist/packages/api/bundle/index.js',
      format: 'cjs',
      inlineDynamicImports: true,
    },
    platform: 'node',
    external: [/@aws-sdk\/.*/],
  },
]);
