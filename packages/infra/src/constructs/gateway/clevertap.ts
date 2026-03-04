import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { suppressRules } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import { Construct } from 'constructs';

export interface ClevertapTargetProps {
  gateway: agentcore.Gateway;
  bundlePath: string;
  clevertapProjectId: string;
  clevertapPasscode: string;
  clevertapRegion: string;
}

export class ClevertapTarget extends Construct {
  readonly lambda: lambda.Function;
  readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: ClevertapTargetProps) {
    super(scope, id);

    const {
      gateway,
      bundlePath,
      clevertapProjectId,
      clevertapPasscode,
      clevertapRegion,
    } = props;

    this.secret = new secretsmanager.Secret(this, 'Secret', {
      description:
        'CleverTap credentials (projectId, passcode, region) for MCP server',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          projectId: clevertapProjectId,
          passcode: clevertapPasscode,
          region: clevertapRegion,
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
      code: lambda.Code.fromAsset(`${bundlePath}/mcp/clevertap`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        CLEVERTAP_SECRET_ARN: this.secret.secretArn,
      },
    });

    this.secret.grantRead(this.lambda);

    const T = agentcore.SchemaDefinitionType;

    const userPropertyFilterSchema = {
      type: T.OBJECT,
      description: 'A user property filter: { name, operator, value }',
      properties: {
        name: {
          type: T.STRING,
          description:
            'Profile property name (e.g. telco_provider, engagement_status, propensity_savings_account)',
        },
        operator: {
          type: T.STRING,
          description:
            'Comparison operator: equals, not_equals, greater_than, greater_than_equals, less_than, less_than_equals, contains, does_not_contain',
        },
        value: {
          type: T.STRING,
          description: 'Value to compare against',
        },
      },
      required: ['name', 'value'],
    };

    const eventFilterSchema = {
      type: T.OBJECT,
      description:
        'Optional event-based filter to combine with user property filters.',
      properties: {
        event_name: {
          type: T.STRING,
          description: 'Event name (e.g. Charged, App Launched)',
        },
        from: { type: T.INTEGER, description: 'Start date YYYYMMDD' },
        to: { type: T.INTEGER, description: 'End date YYYYMMDD' },
      },
      required: ['event_name', 'from', 'to'],
    };

    const toolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'create_draft_campaign',
        description:
          'Validate a campaign in CleverTap using estimate_only=true. Returns estimated reach without sending. Use user_property_filters to target users by their profile properties.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            name: {
              type: T.STRING,
              description: 'Campaign name shown in the CleverTap dashboard',
            },
            target_mode: {
              type: T.STRING,
              description:
                'Channel: push, email, sms, webpush, whatsapp, or webhook',
            },
            content: {
              type: T.OBJECT,
              description:
                'Message content. push: {title, body}. email: {subject, body, sender_name}. sms: {body}.',
            },
            user_property_filters: {
              type: T.ARRAY,
              description:
                'List of user property filters to define the target audience.',
              items: userPropertyFilterSchema,
            },
            event_filter: eventFilterSchema,
            segment: {
              type: T.INTEGER,
              description: 'Segment ID to target instead of filters.',
            },
            when: {
              type: T.STRING,
              description: '"now" or "YYYYMMDD HH:MM". Defaults to "now".',
            },
            provider_nick_name: {
              type: T.STRING,
              description: 'Required for email, sms, or whatsapp.',
            },
            labels: {
              type: T.ARRAY,
              description: 'Optional labels to tag the campaign.',
            },
            webhook_endpoint_name: {
              type: T.STRING,
              description:
                'Required for webhook campaigns. The webhook endpoint name configured in CleverTap.',
            },
            webhook_fields: {
              type: T.ARRAY,
              description:
                'Optional for webhook. Fields to include: profile-attributes, tokens, identities.',
            },
            webhook_key_value: {
              type: T.OBJECT,
              description:
                'Optional for webhook. Custom key-value pairs to send.',
            },
          },
          required: ['name', 'target_mode', 'content', 'user_property_filters'],
        },
      },
      {
        name: 'list_draft_campaigns',
        description:
          'List campaigns created via the CleverTap API within a date range.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            from: { type: T.INTEGER, description: 'Start date YYYYMMDD.' },
            to: { type: T.INTEGER, description: 'End date YYYYMMDD.' },
          },
          required: ['from', 'to'],
        },
      },
      {
        name: 'get_draft_campaign',
        description:
          'Get the report for a specific campaign by its CleverTap campaign ID.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            campaign_id: {
              type: T.INTEGER,
              description: 'The CleverTap campaign ID.',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'update_draft_campaign',
        description:
          'Re-validate a campaign with updated fields using estimate_only=true.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            name: { type: T.STRING, description: 'Campaign name.' },
            target_mode: { type: T.STRING, description: 'Channel type.' },
            content: { type: T.OBJECT, description: 'Updated content.' },
            user_property_filters: {
              type: T.ARRAY,
              description: 'Updated user property filters.',
              items: userPropertyFilterSchema,
            },
            event_filter: eventFilterSchema,
            segment: { type: T.INTEGER, description: 'Updated segment ID.' },
            when: { type: T.STRING, description: 'Updated schedule.' },
            provider_nick_name: {
              type: T.STRING,
              description: 'Updated provider.',
            },
            labels: { type: T.ARRAY, description: 'Updated labels.' },
            webhook_endpoint_name: {
              type: T.STRING,
              description: 'Updated webhook endpoint name.',
            },
            webhook_fields: {
              type: T.ARRAY,
              description: 'Updated webhook fields.',
            },
            webhook_key_value: {
              type: T.OBJECT,
              description: 'Updated webhook key-value pairs.',
            },
          },
          required: ['name', 'target_mode', 'content', 'user_property_filters'],
        },
      },
      {
        name: 'discard_draft_campaign',
        description: 'Stop a scheduled or running campaign in CleverTap.',
        inputSchema: {
          type: T.OBJECT,
          properties: {
            campaign_id: {
              type: T.INTEGER,
              description: 'The CleverTap campaign ID to stop.',
            },
          },
          required: ['campaign_id'],
        },
      },
    ]);

    gateway.addLambdaTarget('ClevertapTarget', {
      gatewayTargetName: 'clevertap-target',
      description: 'CleverTap campaign lifecycle tools',
      lambdaFunction: this.lambda,
      toolSchema,
    });
  }
}
