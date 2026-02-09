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
