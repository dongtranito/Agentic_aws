/**
 * CDK construct that seeds SSM Parameter Store with default agent configurations.
 * Uses a CloudFormation Custom Resource that only creates parameters on initial
 * stack creation (updates and deletes are no-ops).
 *
 * The seed data is written to a JSON file at synth time and bundled into the
 * Lambda deployment package — avoiding CloudFormation property size limits.
 */
import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { IAgentSetting } from ':play-c463-z26-rzy-mar-tech/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SeedConfigProps {
  parameterPrefix: string;
  agents: IAgentSetting[];
}

export class SeedConfig extends Construct {
  constructor(scope: Construct, id: string, props: SeedConfigProps) {
    super(scope, id);

    const { parameterPrefix, agents } = props;

    // Write seed data to a JSON file that gets bundled with the handler.
    const handlersDir = path.join(__dirname, '..', 'handlers');
    const seedDataPath = path.join(handlersDir, 'seed-data.json');
    fs.writeFileSync(
      seedDataPath,
      JSON.stringify({ parameterPrefix, agents }, null, 2),
    );

    const seedFunction = new NodejsFunction(this, 'SeedHandler', {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(handlersDir, 'seed-handler.ts'),
      handler: 'handler',
      timeout: Duration.seconds(30),
      bundling: {
        commandHooks: {
          beforeBundling: () => [],
          afterBundling: (_inputDir: string, outputDir: string) => [
            `cp ${seedDataPath} ${outputDir}/seed-data.json`,
          ],
          beforeInstall: () => [],
        },
      },
    });

    seedFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:PutParameter'],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter${parameterPrefix}/*`,
        ],
      }),
    );

    const provider = new cr.Provider(this, 'ProviderCR', {
      onEventHandler: seedFunction,
    });

    new CustomResource(this, 'SeedCR', {
      serviceToken: provider.serviceToken,
    });
  }
}
