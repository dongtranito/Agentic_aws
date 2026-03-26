// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
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

    // Shared sub-schemas
    const userPropertyFilterSchema = {
      type: T.OBJECT,
      description: 'A user property filter: { name, operator, value }',
      properties: {
        name: {
          type: T.STRING,
          description:
            'Profile property name (e.g. telco_provider, engagement_status)',
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

    // Shared campaign properties used by create, confirm, and update tools
    const campaignProperties = {
      name: { type: T.STRING, description: 'Campaign name' },
      target_mode: {
        type: T.STRING,
        description: 'Channel: push, email, sms, webpush, whatsapp, or webhook',
      },
      content: {
        type: T.OBJECT,
        description:
          'Message content. push: {title, body}. email: {subject, body, sender_name}. sms: {body}.',
      },
      user_property_filters: {
        type: T.ARRAY,
        description: 'User property filters to define the target audience.',
        items: userPropertyFilterSchema,
      },
      event_filter: eventFilterSchema,
      segment: {
        type: T.INTEGER,
        description: 'Segment ID to target instead of filters.',
      },
      when: {
        type: T.STRING,
        description:
          'When to send: "now" for immediate delivery, or "YYYYMMDD HH:MM" to schedule for a specific date and time. Defaults to "now". For recurring campaigns, use the schedule_start, schedule_end, repeat_type and repeat_every parameters instead.',
      },
      schedule_start: {
        type: T.STRING,
        description:
          'Start date/time for a scheduled or recurring campaign in "YYYYMMDD HH:MM" format. When provided, the campaign is scheduled rather than sent immediately.',
      },
      schedule_end: {
        type: T.STRING,
        description:
          'End date for a recurring campaign in "YYYYMMDD" format. The campaign stops recurring after this date.',
      },
      repeat_type: {
        type: T.STRING,
        description:
          'Recurrence type: "day" or "week". Required for recurring campaigns.',
      },
      repeat_every: {
        type: T.INTEGER,
        description:
          'Recurrence interval: number of days or weeks between each run. Required for recurring campaigns.',
      },
      repeat_on_days_of_week: {
        type: T.ARRAY,
        description:
          'Days of week for weekly recurring campaigns. Values 1 (Sun) to 7 (Sat). Required when repeat_type is "week".',
      },
      provider_nick_name: {
        type: T.STRING,
        description: 'Required for email, sms, or whatsapp.',
      },
      labels: { type: T.ARRAY, description: 'Optional labels.' },
      webhook_endpoint_name: {
        type: T.STRING,
        description: 'Required for webhook campaigns.',
      },
      webhook_fields: {
        type: T.ARRAY,
        description:
          'For webhook. Fields to include: profile-attributes, tokens, identities.',
      },
      webhook_key_value: {
        type: T.OBJECT,
        description: 'Optional webhook key-value pairs.',
      },
    };

    const campaignRequired = [
      'name',
      'target_mode',
      'content',
      'user_property_filters',
    ];

    const toolSchema = agentcore.ToolSchema.fromInline([
      {
        name: 'create_draft_campaign',
        description:
          'Validate a campaign in CleverTap (estimate_only=true). Returns estimated reach without sending.',
        inputSchema: {
          type: T.OBJECT,
          properties: campaignProperties,
          required: campaignRequired,
        },
      },
      {
        name: 'confirm_draft_campaign',
        description:
          'Create the campaign in CleverTap (estimate_only=false). If Campaign Approval is enabled, it enters Pending Approval. Use after the user reviews the estimate.',
        inputSchema: {
          type: T.OBJECT,
          properties: campaignProperties,
          required: campaignRequired,
        },
      },
      {
        name: 'update_draft_campaign',
        description:
          'Re-validate a campaign with updated fields (estimate_only=true).',
        inputSchema: {
          type: T.OBJECT,
          properties: campaignProperties,
          required: campaignRequired,
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
