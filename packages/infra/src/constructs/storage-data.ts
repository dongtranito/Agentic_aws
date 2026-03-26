// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { suppressRules } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageAndData extends Construct {
  readonly accessLogsBucket: s3.Bucket;
  readonly sessionsBucket: s3.Bucket;
  readonly sqlResultsBucket: s3.Bucket;
  readonly campaigns: ddb.Table;
  readonly taskActiveIndex: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.campaigns = new ddb.Table(this, 'Campaigns', {
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING,
      },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      encryption: ddb.TableEncryption.AWS_MANAGED,
    });

    this.taskActiveIndex = 'CampaignActiveIndex';
    this.campaigns.addGlobalSecondaryIndex({
      indexName: this.taskActiveIndex,
      partitionKey: {
        name: 'active',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: ddb.AttributeType.NUMBER,
      },
      projectionType: ddb.ProjectionType.ALL,
    });

    this.accessLogsBucket = new s3.Bucket(this, 'AccessLogs', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      enforceSSL: true,
    });

    this.sessionsBucket = new s3.Bucket(this, 'SessionsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      eventBridgeEnabled: true,
      enforceSSL: true,
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'sessions',
    });

    suppressRules(
      this.accessLogsBucket,
      ['CKV_AWS_21'],
      'Access log bucket does not need versioning enabled',
    );
    suppressRules(
      this.accessLogsBucket,
      ['CKV_AWS_18'],
      'Access log bucket does not need access logging',
    );
    suppressRules(
      this.sessionsBucket,
      ['CKV_AWS_21'],
      'Sessions bucket does not need versioning enabled',
    );

    this.sqlResultsBucket = new s3.Bucket(this, 'SqlResultsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      enforceSSL: true,
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'sql-results',
      cors: [
        {
          // TODO: restrict this later
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    suppressRules(
      this.sqlResultsBucket,
      ['CKV_AWS_21'],
      'SQL results bucket does not need versioning enabled',
    );

    suppressRules(
      this.campaigns,
      ['CKV_AWS_119'],
      'Custom CMK encryption is a path to production concern',
    );
  }
}
