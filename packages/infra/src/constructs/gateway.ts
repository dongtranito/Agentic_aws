/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';
import * as url from 'url';
import * as path from 'path';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export class GatewayConstruct extends Construct {
  readonly gateway: agentcore.Gateway;
  readonly databricksLambda: lambda.Function;
  readonly clevertapLambda: lambda.Function;
  readonly talonOneLambda: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bundlePath = path.resolve(
      __dirname,
      '../../../../dist/packages/api/bundle',
    );

    // Create Lambda functions for each MCP server
    this.databricksLambda = new lambda.Function(this, 'DatabricksLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(bundlePath, 'mcp/databricks')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.clevertapLambda = new lambda.Function(this, 'ClevertapLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(bundlePath, 'mcp/clevertap')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.talonOneLambda = new lambda.Function(this, 'TalonOneLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(bundlePath, 'mcp/talonone')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Create the MCP Gateway with IAM authentication
    this.gateway = new agentcore.Gateway(this, 'McpGateway', {
      gatewayName: 'marketer-gateway',
      description:
        'MCP Gateway for marketing tools (Databricks, CleverTap, TalonOne)',
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingAwsIam(),
    });

    // Define tool schemas for Databricks
    const databricksToolSchema = agentcore.ToolSchema.fromInline([
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

    // Define tool schemas for CleverTap
    const clevertapToolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'clevertap_get_user_profile',
        description: 'Get a user profile from CleverTap',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            user_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The user ID to get profile for',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'clevertap_get_campaign_stats',
        description: 'Get statistics for a CleverTap campaign',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            campaign_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The campaign ID to get stats for',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'clevertap_list_segments',
        description: 'List all user segments in CleverTap',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'clevertap_get_event_data',
        description: 'Get event analytics data from CleverTap',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            event_name: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The event name to get data for',
            },
          },
          required: ['event_name'],
        },
      },
      {
        name: 'clevertap_send_push_notification',
        description: 'Send a push notification to a user via CleverTap',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            user_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The user ID to send notification to',
            },
            title: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Notification title',
            },
            body: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Notification body',
            },
          },
          required: ['user_id', 'title', 'body'],
        },
      },
      {
        name: 'clevertap_create_segment',
        description: 'Create a new user segment in CleverTap',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            name: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Segment name',
            },
            criteria: {
              type: agentcore.SchemaDefinitionType.OBJECT,
              description: 'Segment criteria/filters',
            },
          },
          required: ['name', 'criteria'],
        },
      },
    ]);

    // Define tool schemas for TalonOne
    const talonOneToolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'talonone_get_campaign',
        description: 'Get details of a TalonOne promotion campaign',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            campaign_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The campaign ID',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'talonone_list_campaigns',
        description: 'List all TalonOne promotion campaigns',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'talonone_get_customer_session',
        description: 'Get a customer shopping session from TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            customer_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The customer ID',
            },
          },
          required: ['customer_id'],
        },
      },
      {
        name: 'talonone_update_customer_session',
        description: 'Update a customer shopping session in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            customer_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The customer ID',
            },
            cart_items: {
              type: agentcore.SchemaDefinitionType.ARRAY,
              description: 'Cart items to update',
            },
          },
          required: ['customer_id'],
        },
      },
      {
        name: 'talonone_get_loyalty_program',
        description: 'Get loyalty program details from TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'talonone_get_customer_loyalty',
        description: 'Get customer loyalty status and points from TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            customer_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The customer ID',
            },
          },
          required: ['customer_id'],
        },
      },
      {
        name: 'talonone_redeem_points',
        description: 'Redeem loyalty points for a customer in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            customer_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The customer ID',
            },
            reward_id: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The reward to redeem',
            },
            points: {
              type: agentcore.SchemaDefinitionType.NUMBER,
              description: 'Points to redeem',
            },
          },
          required: ['customer_id', 'reward_id'],
        },
      },
      {
        name: 'talonone_list_coupons',
        description: 'List all coupons in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'talonone_validate_coupon',
        description: 'Validate a coupon code in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            coupon_code: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'The coupon code to validate',
            },
          },
          required: ['coupon_code'],
        },
      },
      {
        name: 'talonone_create_coupon',
        description: 'Create a new coupon in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            code: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Coupon code',
            },
            discount_type: {
              type: agentcore.SchemaDefinitionType.STRING,
              description:
                'Type of discount (percentage, fixed, free_shipping)',
            },
            value: {
              type: agentcore.SchemaDefinitionType.NUMBER,
              description: 'Discount value',
            },
            max_uses: {
              type: agentcore.SchemaDefinitionType.NUMBER,
              description: 'Maximum number of uses',
            },
            expires: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Expiration date (ISO format)',
            },
          },
          required: ['code', 'discount_type', 'value'],
        },
      },
    ]);

    // Add Lambda targets to the gateway
    this.gateway.addLambdaTarget('DatabricksTarget', {
      gatewayTargetName: 'databricks-target',
      description: 'Databricks data analytics and audience segmentation tools',
      lambdaFunction: this.databricksLambda,
      toolSchema: databricksToolSchema,
    });

    this.gateway.addLambdaTarget('ClevertapTarget', {
      gatewayTargetName: 'clevertap-target',
      description: 'CleverTap customer engagement and push notification tools',
      lambdaFunction: this.clevertapLambda,
      toolSchema: clevertapToolSchema,
    });

    this.gateway.addLambdaTarget('TalonOneTarget', {
      gatewayTargetName: 'talonone-target',
      description: 'TalonOne loyalty and promotions management tools',
      lambdaFunction: this.talonOneLambda,
      toolSchema: talonOneToolSchema,
    });
  }
}
