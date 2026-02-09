/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Api } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as api from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface APIConstructProps {
  readonly userPool: cognito.IUserPool;
}

export class APIConstruct extends Construct {
  readonly restAPI: api.RestApi;

  constructor(scope: Construct, id: string, props: APIConstructProps) {
    super(scope, id);

    const { userPool } = props;

    const api = new Api(this, 'RestAPI', {
      identity: {
        userPool,
      },
      integrations: Api.defaultIntegrations(this).build(),
    });

    this.restAPI = api.api;
  }
}
