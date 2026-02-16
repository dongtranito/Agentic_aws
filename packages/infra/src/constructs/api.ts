/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Api } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MarketerAgent } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as url from 'url';

export interface APIConstructProps {
  readonly userPool: cognito.IUserPool;
  readonly campaignsTable: ddb.ITable;
  readonly campaignActiveIndex: string;
  readonly sessionsBucket: s3.IBucket;
  readonly marketerAgent: MarketerAgent;
}

const getBundlePath = (handler: string) =>
  url.fileURLToPath(
    new URL(`../../../../dist/packages/api/bundle/${handler}`, import.meta.url),
  );

export class APIConstruct extends Construct {
  readonly restAPI: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: APIConstructProps) {
    super(scope, id);

    const { userPool, campaignsTable, campaignActiveIndex, marketerAgent } =
      props;

    // Lambda for GET /campaign/:id
    const getCampaignHandler = new lambda.Function(this, 'GetCampaignHandler', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(getBundlePath('getCampaign')),
      timeout: Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        CAMPAIGNS_TABLE_NAME: campaignsTable.tableName,
      },
    });

    getCampaignHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [campaignsTable.tableArn],
      }),
    );

    // Lambda for GET /campaign (list all)
    const getCampaignsHandler = new lambda.Function(
      this,
      'GetCampaignsHandler',
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(getBundlePath('getCampaigns')),
        timeout: Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          CAMPAIGNS_TABLE_NAME: campaignsTable.tableName,
          CAMPAIGN_ACTIVE_INDEX: campaignActiveIndex,
        },
      },
    );

    getCampaignsHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query'],
        resources: [`${campaignsTable.tableArn}/index/${campaignActiveIndex}`],
      }),
    );

    // Lambda for POST /campaign
    const createCampaignHandler = new lambda.Function(
      this,
      'CreateCampaignHandler',
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(getBundlePath('createCampaign')),
        timeout: Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          CAMPAIGNS_TABLE_NAME: campaignsTable.tableName,
        },
      },
    );

    createCampaignHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [campaignsTable.tableArn],
      }),
    );

    // Lambda for PUT /chat (streaming)
    const putChatHandler = new lambda.Function(this, 'PutChatHandler', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(getBundlePath('putChat')),
      timeout: Duration.minutes(5),
      environment: {
        AGENT_RUNTIME_ARN: marketerAgent.agentCoreRuntime.agentRuntimeArn,
      },
    });

    marketerAgent.agentCoreRuntime.grantInvoke(putChatHandler);

    const api = new Api(this, 'RestAPI', {
      identity: { userPool },
      getCampaign: {
        handler: getCampaignHandler,
        integration: new apigateway.LambdaIntegration(getCampaignHandler),
      },
      getCampaigns: {
        handler: getCampaignsHandler,
        integration: new apigateway.LambdaIntegration(getCampaignsHandler),
      },
      createCampaign: {
        handler: createCampaignHandler,
        integration: new apigateway.LambdaIntegration(createCampaignHandler),
      },
      putChat: {
        handler: putChatHandler,
        integration: new apigateway.LambdaIntegration(putChatHandler, {
          responseTransferMode: apigateway.ResponseTransferMode.STREAM,
        }),
      },
    });

    this.restAPI = api.api;
  }
}
