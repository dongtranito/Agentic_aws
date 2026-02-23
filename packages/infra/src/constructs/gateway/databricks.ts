import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';
import { suppressRules } from ':play-c463-z26-rzy-mar-tech/common-constructs';

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
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        DATABRICKS_SECRET_ARN: this.secret.secretArn,
      },
    });

    this.secret.grantRead(this.lambda);

    suppressRules(
      this.secret,
      ['CKV_AWS_149'],
      'KMS CMK are a path to production concern',
    );

    const T = agentcore.SchemaDefinitionType;

    const toolSchema = agentcore.ToolSchema.fromInline([
      // SQL Statement Execution API
      {
        name: 'databricks_execute_sql',
        description:
          'Execute a SQL query against a Databricks SQL warehouse. Returns results directly for short queries or a statement_id for long-running ones.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            query: { type: T.STRING, description: 'The SQL query to execute' },
            warehouse_id: {
              type: T.STRING,
              description: 'The SQL warehouse ID to run the query on',
            },
            catalog: {
              type: T.STRING,
              description: 'Default catalog for the query (optional)',
            },
            schema: {
              type: T.STRING,
              description: 'Default schema for the query (optional)',
            },
            row_limit: {
              type: T.NUMBER,
              description: 'Max rows to return (optional, default 1000)',
            },
          },
          required: ['query', 'warehouse_id'],
        },
      },
      {
        name: 'databricks_get_statement_result',
        description:
          'Poll for results of a previously submitted SQL statement. Use when databricks_execute_sql returns a PENDING or RUNNING status.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            statement_id: {
              type: T.STRING,
              description:
                'The statement ID returned by databricks_execute_sql',
            },
          },
          required: ['statement_id'],
        },
      },
      // SQL Warehouses API
      {
        name: 'databricks_list_warehouses',
        description:
          'List all available SQL warehouses. Use this to discover warehouse IDs before running queries.',
        inputSchema: {
          type: T.OBJECT,
          properties: {},
        },
      },
      // Unity Catalog APIs
      {
        name: 'databricks_list_schemas',
        description:
          'List all schemas in a Unity Catalog catalog. Use for data discovery.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            catalog_name: {
              type: T.STRING,
              description: 'The catalog name to list schemas from',
            },
          },
          required: ['catalog_name'],
        },
      },
      {
        name: 'databricks_list_tables',
        description:
          'List all tables in a Unity Catalog schema. Use for data discovery.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            catalog_name: { type: T.STRING, description: 'The catalog name' },
            schema_name: {
              type: T.STRING,
              description: 'The schema name to list tables from',
            },
          },
          required: ['catalog_name', 'schema_name'],
        },
      },
      {
        name: 'databricks_get_table',
        description:
          'Get table details including column names and types from Unity Catalog. Use to understand table structure before writing queries.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            full_name: {
              type: T.STRING,
              description: 'Full table name in format: catalog.schema.table',
            },
          },
          required: ['full_name'],
        },
      },
      // Jobs API
      {
        name: 'databricks_run_job',
        description:
          'Trigger a Databricks job run. Use for ETL pipelines or scheduled tasks.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            job_id: { type: T.NUMBER, description: 'The job ID to run' },
            notebook_params: {
              type: T.OBJECT,
              description: 'Parameters to pass to the notebook (optional)',
            },
          },
          required: ['job_id'],
        },
      },
      {
        name: 'databricks_get_job_run',
        description: 'Check the status of a Databricks job run.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            run_id: {
              type: T.NUMBER,
              description: 'The run ID to check status for',
            },
          },
          required: ['run_id'],
        },
      },
    ]);

    gateway.addLambdaTarget('DatabricksTarget', {
      gatewayTargetName: 'databricks-target',
      description:
        'Databricks SQL execution, data discovery, and job management tools',
      lambdaFunction: this.lambda,
      toolSchema,
    });
  }
}
