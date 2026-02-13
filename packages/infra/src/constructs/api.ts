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
  readonly sessionsBucket: s3.IBucket;
  readonly marketerAgent: MarketerAgent;
}

export class APIConstruct extends Construct {
  readonly restAPI: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: APIConstructProps) {
    super(scope, id);

    const { userPool, campaignsTable, marketerAgent } = props;

    const apiBundlePath = url.fileURLToPath(
      new URL('../../../../dist/packages/api/bundle', import.meta.url),
    );

    // Lambda for GET /campaign/:id
    const getCampaignHandler = new lambda.Function(this, 'GetCampaignHandler', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.getCampaign.handler',
      code: lambda.Code.fromAsset(apiBundlePath),
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

    // Lambda for PUT /chat (streaming)
    const putChatHandler = new lambda.Function(this, 'PutChatHandler', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.putChat.handler',
      code: lambda.Code.fromAsset(apiBundlePath),
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
