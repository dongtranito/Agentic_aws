import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface TalonOneTargetProps {
  gateway: agentcore.Gateway;
  bundlePath: string;
}

export class TalonOneTarget extends Construct {
  readonly lambda: lambda.Function;

  constructor(scope: Construct, id: string, props: TalonOneTargetProps) {
    super(scope, id);

    const { gateway, bundlePath } = props;

    this.lambda = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${bundlePath}/mcp/talonone`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    const toolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'get_campaign',
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
        name: 'list_campaigns',
        description: 'List all TalonOne promotion campaigns',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'get_customer_session',
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
        name: 'update_customer_session',
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
        name: 'get_loyalty_program',
        description: 'Get loyalty program details from TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'get_customer_loyalty',
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
        name: 'redeem_points',
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
        name: 'list_coupons',
        description: 'List all coupons in TalonOne',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'validate_coupon',
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
        name: 'create_coupon',
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

    gateway.addLambdaTarget('TalonOneTarget', {
      gatewayTargetName: 'talonone-target',
      description: 'TalonOne loyalty and promotions management tools',
      lambdaFunction: this.lambda,
      toolSchema,
    });
  }
}
