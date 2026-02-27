import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface MarketerAgentConstructProps {
  gateway: agentcore.Gateway;
  memory: agentcore.Memory;
  sessionsBucket: s3.IBucket;
  databricksRuntime: agentcore.Runtime;
  clevertapRuntime: agentcore.Runtime;
  talononeRuntime: agentcore.Runtime;
}

export class MarketerAgentConstruct extends Construct {
  readonly agent: MarketerAgent;
  readonly executionRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: MarketerAgentConstructProps,
  ) {
    super(scope, id);

    const {
      gateway,
      memory,
      sessionsBucket,
      databricksRuntime,
      clevertapRuntime,
      talononeRuntime,
    } = props;

    this.executionRole = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:Converse',
                'bedrock:ConverseStream',
              ],
              resources: ['*'],
              effect: iam.Effect.ALLOW,
            }),
          ],
        }),
      },
    });

    memory.grantFullAccess(this.executionRole);
    gateway.grantInvoke(this.executionRole);
    sessionsBucket.grantReadWrite(this.executionRole);

    // Grant invoke + GetAgentCard for all worker agent runtimes
    for (const runtime of [
      databricksRuntime,
      clevertapRuntime,
      talononeRuntime,
    ]) {
      runtime.grantInvoke(this.executionRole);
      this.executionRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:GetAgentCard'],
          resources: [`${runtime.agentRuntimeArn}*`],
        }),
      );
    }

    this.agent = new MarketerAgent(this, 'Agent', {
      executionRole: this.executionRole,
      environmentVariables: {
        MEMORY_ID: memory.memoryId,
        GATEWAY_URL: gateway.gatewayUrl ?? '',
        ARTIFACT_BUCKET: sessionsBucket.bucketName,
        DATABRICKS_A2A_ENDPOINT: databricksRuntime.agentRuntimeArn,
        CLEVERTAP_A2A_ENDPOINT: clevertapRuntime.agentRuntimeArn,
        TALONONE_A2A_ENDPOINT: talononeRuntime.agentRuntimeArn,
      },
    });
  }
}
