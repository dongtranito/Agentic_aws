import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface DatabricksTargetProps {
  gateway: agentcore.Gateway;
  bundlePath: string;
  databricksUrl: string;
  databricksToken: string;
}

export class DatabricksTarget extends Construct {
  readonly lambda: lambda.Function;
  readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabricksTargetProps) {
    super(scope, id);

    const { gateway, bundlePath, databricksUrl, databricksToken } = props;

    this.secret = new secretsmanager.Secret(this, 'Secret', {
      description: 'Databricks credentials (URL and PAT) for MCP server',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({ url: databricksUrl, token: databricksToken }),
      ),
    });

    this.lambda = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${bundlePath}/mcp/databricks`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DATABRICKS_SECRET_ARN: this.secret.secretArn,
      },
    });

    this.secret.grantRead(this.lambda);

    const toolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'databricks_get_campaign_performance',
        description:
          'Get performance metrics for a marketing campaign from Databricks',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            campaign_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The campaign ID to get performance for',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'databricks_list_audience_segments',
        description: 'List all audience segments available in Databricks',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'databricks_run_sql_query',
        description: 'Run a SQL query against the Databricks data warehouse',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            query: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The SQL query to execute',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'databricks_get_customer_insights',
        description: 'Get customer insights and analytics from Databricks',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            customer_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The customer ID to get insights for',
            },
          },
          required: ['customer_id'],
        },
      },
    ]);

    gateway.addLambdaTarget('DatabricksTarget', {
      gatewayTargetName: 'databricks-target',
      description: 'Databricks data analytics and audience segmentation tools',
      lambdaFunction: this.lambda,
      toolSchema,
    });
  }
}
