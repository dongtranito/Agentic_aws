// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { AwsNxPluginConfig } from '@aws/nx-plugin';

export default {
  iac: { provider: 'CDK' },
  tags: ['PE-C463Z26RZY'],
  license: {
    spdx: 'ASL',
    copyrightHolder: 'Amazon.com, Inc. or its affiliates',
    copyrightYear: 2026,
    header: {
      content: {
        lines: [
          'Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.',
          'SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0',
          'Licensed under the Amazon Software License  https://aws.amazon.com/asl/',
        ],
      },
      format: {
        '**/*.{ts,tsx,mts,mjs,js,jsx}': {
          lineStart: '// ',
        },
        '**/*.py': {
          lineStart: '# ',
        },
        '**/*.css': {
          blockStart: '/*',
          lineStart: ' * ',
          blockEnd: ' */',
        },
      },
      exclude: ['**/*.gen.ts'],
    },
  },
} satisfies AwsNxPluginConfig;
