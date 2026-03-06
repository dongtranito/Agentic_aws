import { TalononeAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface TalononeAgentConstructProps {
  gateway: agentcore.Gateway;
  parameterPrefix: string;
}

export class TalononeAgentConstruct extends Construct {
  readonly agent: TalononeAgent;
  readonly executionRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: TalononeAgentConstructProps,
  ) {
    super(scope, id);

    const { gateway, parameterPrefix } = props;

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
            new iam.PolicyStatement({
              actions: ['ssm:GetParameter'],
              resources: [
                `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter${parameterPrefix}/*`,
              ],
              effect: iam.Effect.ALLOW,
            }),
          ],
        }),
      },
    });

    gateway.grantInvoke(this.executionRole);

    this.agent = new TalononeAgent(this, 'Agent', {
      executionRole: this.executionRole,
      environmentVariables: {
        GATEWAY_URL: gateway.gatewayUrl ?? '',
        AGENT_CONFIG_PARAMETER: `${parameterPrefix}/talonone/config`,
      },
    });
  }
}
