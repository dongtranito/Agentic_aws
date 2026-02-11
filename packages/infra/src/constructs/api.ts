/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Api } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as api from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface APIConstructProps {
  readonly userPool: cognito.IUserPool;
  readonly campaignsTable: ddb.ITable;
  readonly sessionsBucket: s3.IBucket;
}

export class APIConstruct extends Construct {
  readonly restAPI: api.RestApi;

  constructor(scope: Construct, id: string, props: APIConstructProps) {
    super(scope, id);

    const { userPool, campaignsTable } = props;

    const api = new Api(this, 'RestAPI', {
      identity: {
        userPool,
      },
      integrations: Api.defaultIntegrations(this).build(),
    });

    const getCampaginHandler = api.integrations['campaign.get'].handler;
    getCampaginHandler.addEnvironment(
      'CAMPAIGNS_TABLE_NAME',
      campaignsTable.tableName,
    );
    getCampaginHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [campaignsTable.tableArn],
      }),
    );

    this.restAPI = api.api;
  }
}
