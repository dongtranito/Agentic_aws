import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { suppressRules } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import { Construct } from 'constructs';

export interface TalonOneTargetProps {
  gateway: agentcore.Gateway;
  bundlePath: string;
  talonOneBaseUrl: string;
  talonOneApplicationId: number;
  talonOneManagementKey: string;
  talonOneIntegrationKey: string;
}

export class TalonOneTarget extends Construct {
  readonly lambda: lambda.Function;
  readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: TalonOneTargetProps) {
    super(scope, id);

    const {
      gateway,
      bundlePath,
      talonOneBaseUrl,
      talonOneApplicationId,
      talonOneManagementKey,
      talonOneIntegrationKey,
    } = props;

    this.secret = new secretsmanager.Secret(this, 'Secret', {
      description:
        'TalonOne credentials (baseUrl, applicationId, managementKey, integrationKey) for MCP server',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          baseUrl: talonOneBaseUrl,
          applicationId: talonOneApplicationId,
          managementKey: talonOneManagementKey,
          integrationKey: talonOneIntegrationKey,
        }),
      ),
    });

    suppressRules(
      this.secret,
      ['CKV_AWS_149'],
      'KMS CMK are a path to production concern',
    );

    this.lambda = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${bundlePath}/mcp/talonone`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TALONONE_SECRET_ARN: this.secret.secretArn,
      },
    });

    this.secret.grantRead(this.lambda);

    const T = agentcore.SchemaDefinitionType;

    const toolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'get_campaign',
        description: 'Get details of a TalonOne promotion campaign by ID.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            campaign_id: {
              type: T.NUMBER,
              description: 'The campaign ID',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'list_campaigns',
        description:
          'List TalonOne promotion campaigns. Optionally filter by state.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            state: {
              type: T.STRING,
              description:
                'Filter by campaign state: enabled, running, disabled, expired, archived',
            },
            page_size: {
              type: T.NUMBER,
              description: 'Number of results per page (default 25)',
            },
            skip: {
              type: T.NUMBER,
              description: 'Number of results to skip for pagination',
            },
          },
        },
      },
      {
        name: 'create_campaign',
        description:
          'Create a new promotion campaign in TalonOne. Returns the created campaign with its ID.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            name: {
              type: T.STRING,
              description: 'Campaign name',
            },
            description: {
              type: T.STRING,
              description: 'Campaign description',
            },
            state: {
              type: T.STRING,
              description:
                'Initial state: enabled or disabled (default disabled)',
            },
            start_time: {
              type: T.STRING,
              description:
                'Campaign start time in ISO 8601 format (defaults to now)',
            },
            end_time: {
              type: T.STRING,
              description: 'Campaign end time in ISO 8601 format',
            },
            tags: {
              type: T.ARRAY,
              description: 'Tags for the campaign',
            },
            features: {
              type: T.ARRAY,
              description:
                'Campaign features to enable: coupons, referrals, loyalty',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'get_customer_session',
        description:
          'Get customer shopping sessions from TalonOne by customer profile ID.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            customer_id: {
              type: T.STRING,
              description: 'The customer profile integration ID',
            },
          },
          required: ['customer_id'],
        },
      },
      {
        name: 'update_customer_session',
        description:
          'Update or create a customer shopping session in TalonOne. Returns applied promotion effects.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            session_id: {
              type: T.STRING,
              description: 'The session integration ID',
            },
            customer_id: {
              type: T.STRING,
              description: 'The customer profile integration ID',
            },
            cart_items: {
              type: T.ARRAY,
              description:
                'Cart items array. Each item: { name, sku, quantity, price, ... }',
            },
            state: {
              type: T.STRING,
              description: 'Session state: open, closed, partially_returned',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'get_loyalty_program',
        description:
          'Get loyalty program details. If program_id is omitted, lists all programs.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            program_id: {
              type: T.NUMBER,
              description:
                'The loyalty program ID (optional, lists all if omitted)',
            },
          },
        },
      },
      {
        name: 'get_customer_loyalty',
        description:
          'Get customer loyalty ledger balances (active, pending, expired, spent points).',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            customer_id: {
              type: T.STRING,
              description: 'The customer profile integration ID',
            },
            program_id: {
              type: T.NUMBER,
              description: 'The loyalty program ID',
            },
          },
          required: ['customer_id', 'program_id'],
        },
      },
      {
        name: 'redeem_points',
        description:
          'Deduct loyalty points from a customer balance in TalonOne.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            customer_id: {
              type: T.STRING,
              description: 'The customer profile integration ID',
            },
            program_id: {
              type: T.NUMBER,
              description: 'The loyalty program ID',
            },
            points: {
              type: T.NUMBER,
              description: 'Number of points to redeem',
            },
            reward_id: {
              type: T.STRING,
              description: 'Optional reward identifier for tracking',
            },
          },
          required: ['customer_id', 'program_id', 'points'],
        },
      },
      {
        name: 'list_coupons',
        description: 'List coupons for a specific campaign in TalonOne.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            campaign_id: {
              type: T.NUMBER,
              description: 'The campaign ID to list coupons for',
            },
            page_size: {
              type: T.NUMBER,
              description: 'Number of results per page',
            },
            skip: {
              type: T.NUMBER,
              description: 'Number of results to skip for pagination',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'validate_coupon',
        description: 'Search for and validate a coupon code in TalonOne.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            coupon_code: {
              type: T.STRING,
              description: 'The coupon code to validate',
            },
          },
          required: ['coupon_code'],
        },
      },
      {
        name: 'create_coupon',
        description: 'Create a new coupon for a campaign in TalonOne.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            campaign_id: {
              type: T.NUMBER,
              description: 'The campaign ID to create the coupon in',
            },
            code: {
              type: T.STRING,
              description:
                'Coupon code pattern (use # for random chars, e.g. SUMMER-####)',
            },
            discount_type: {
              type: T.STRING,
              description:
                'Type of discount: percentage, fixed, or free_shipping',
            },
            value: {
              type: T.NUMBER,
              description: 'Discount value',
            },
            max_uses: {
              type: T.NUMBER,
              description: 'Maximum number of uses (default 1000)',
            },
            expires: {
              type: T.STRING,
              description: 'Expiration date in ISO 8601 format',
            },
          },
          required: ['campaign_id', 'code', 'discount_type', 'value'],
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
