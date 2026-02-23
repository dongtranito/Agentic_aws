import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export interface ClevertapTargetProps {
  gateway: agentcore.Gateway;
  bundlePath: string;
}

export class ClevertapTarget extends Construct {
  readonly lambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ClevertapTargetProps) {
    super(scope, id);

    const { gateway, bundlePath } = props;

    this.lambda = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${bundlePath}/mcp/clevertap`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    const toolSchema = agentcore.ToolSchema.fromInline([
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

    gateway.addLambdaTarget('ClevertapTarget', {
      gatewayTargetName: 'clevertap-target',
      description: 'CleverTap customer engagement and push notification tools',
      lambdaFunction: this.lambda,
      toolSchema,
    });
  }
}
