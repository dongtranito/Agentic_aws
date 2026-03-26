// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import * as url from 'url';
import { Construct } from 'constructs';
import { StaticWebsite } from '../../core/index.js';

export class WebUi extends StaticWebsite {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      websiteName: 'WebUi',
      websiteFilePath: url.fileURLToPath(
        new URL(
          '../../../../../../dist/packages/web-ui/bundle',
          import.meta.url,
        ),
      ),
    });
  }
}
