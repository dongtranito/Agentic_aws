// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { CfnOutput, CfnResource, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { RuntimeConfig } from './runtime-config.js';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { suppressRules } from './checkov.js';

const DEFAULT_RUNTIME_CONFIG_FILENAME = 'runtime-config.json';

export interface StaticWebsiteProps {
  readonly websiteName: string;
  readonly websiteFilePath: string;
}

/**
 * Deploys a Static Website using by default a private S3 bucket as an origin and Cloudfront as the entrypoint.
 *
 * This construct configures a webAcl containing rules that are generally applicable to web applications. This
 * provides protection against exploitation of a wide range of vulnerabilities, including some of the high risk
 * and commonly occurring vulnerabilities described in OWASP publications such as OWASP Top 10.
 *
 * [VI] Triển khai một website tĩnh, mặc định dùng một S3 bucket riêng tư làm origin và Cloudfront làm điểm vào (entrypoint).
 *
 * Construct này cấu hình một webAcl chứa các quy tắc thường áp dụng cho ứng dụng web, giúp
 * bảo vệ trước việc khai thác nhiều loại lỗ hổng, bao gồm một số lỗ hổng rủi ro cao và
 * thường gặp được mô tả trong các tài liệu của OWASP, chẳng hạn OWASP Top 10.
 *
 */
export class StaticWebsite extends Construct {
  public readonly websiteBucket: IBucket;
  public readonly cloudFrontDistribution: Distribution;
  public readonly bucketDeployment: BucketDeployment;

  constructor(
    scope: Construct,
    id: string,
    { websiteFilePath, websiteName }: StaticWebsiteProps,
  ) {
    super(scope, id);
    this.node.setContext(
      '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy',
      true,
    );

    const websiteKey = new Key(this, 'WebsiteKey', {
      enableKeyRotation: true,
    });

    const accessLogsBucket = new Bucket(this, 'AccessLogsBucket', {
      versioned: false,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: BucketEncryption.KMS,
      encryptionKey: websiteKey,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
    suppressRules(
      accessLogsBucket,
      ['CKV_AWS_21'],
      'Access log bucket does not need versioning enabled',
    );
    suppressRules(
      accessLogsBucket,
      ['CKV_AWS_18'],
      'Access log bucket does not need an access log bucket',
    );

    // S3 Bucket to hold website files
    // [VI] S3 Bucket để chứa các file của website
    this.websiteBucket = new Bucket(this, 'WebsiteBucket', {
      versioned: true,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: BucketEncryption.KMS,
      encryptionKey: websiteKey,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsPrefix: 'website-access-logs',
      serverAccessLogsBucket: accessLogsBucket,
    });
    // Web ACL
    // [VI] Web ACL (danh sách kiểm soát truy cập web - tường lửa ứng dụng web)
    const wafStack = new CloudfrontWebAcl(this, 'waf');

    // Cloudfront Distribution
    // [VI] Cloudfront Distribution (phân phối nội dung qua CDN)
    const logBucket = new Bucket(this, 'DistributionLogBucket', {
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: BucketEncryption.KMS,
      encryptionKey: websiteKey,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsPrefix: 'distribution-access-logs',
      serverAccessLogsBucket: accessLogsBucket,
    });
    suppressRules(
      logBucket,
      ['CKV_AWS_21'],
      'Distribution log bucket does not need versioning enabled',
    );

    const defaultRootObject = 'index.html';
    this.cloudFrontDistribution = new Distribution(
      this,
      'CloudfrontDistribution',
      {
        webAclId: wafStack.wafArn,
        enableLogging: true,
        logBucket: logBucket,
        defaultBehavior: {
          origin: S3BucketOrigin.withOriginAccessControl(this.websiteBucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject,
        errorResponses: [
          {
            httpStatus: 404, // We need to redirect "key not found errors" to index.html for single page apps
            // [VI] httpStatus 404: cần chuyển hướng lỗi "không tìm thấy key" về index.html cho ứng dụng SPA (single page app)
            responseHttpStatus: 200,
            responsePagePath: `/${defaultRootObject}`,
          },
          {
            httpStatus: 403, // We need to redirect reloads from paths (e.g. /foo/bar) to index.html for single page apps
            // [VI] httpStatus 403: cần chuyển hướng việc tải lại từ các đường dẫn (vd: /foo/bar) về index.html cho ứng dụng SPA
            responseHttpStatus: 200,
            responsePagePath: `/${defaultRootObject}`,
          },
        ],
      },
    );
    suppressRules(
      this.cloudFrontDistribution,
      ['CKV_AWS_174'],
      'Cloudfront default certificate does not use TLS 1.2',
    );

    // Deploy Website
    // [VI] Triển khai Website
    this.bucketDeployment = new BucketDeployment(this, 'WebsiteDeployment', {
      sources: [
        Source.asset(websiteFilePath),
        Source.jsonData(
          DEFAULT_RUNTIME_CONFIG_FILENAME,
          RuntimeConfig.ensure(this).config,
        ),
      ],
      destinationBucket: this.websiteBucket,
      // Files in the distribution's edge caches will be invalidated after files are uploaded to the destination bucket.
      // [VI] Các file trong bộ nhớ đệm (edge cache) của distribution sẽ bị vô hiệu hóa (invalidate) sau khi file được tải lên bucket đích.
      distribution: this.cloudFrontDistribution,
      memoryLimit: 1024,
    });

    suppressRules(
      Stack.of(this),
      ['CKV_AWS_111'],
      'CDK Bucket Deployment uses wildcard to deploy arbitrary assets',
      (c) =>
        CfnResource.isCfnResource(c) &&
        c.cfnResourceType === 'AWS::IAM::Policy' &&
        c.node.path.includes(`/Custom::CDKBucketDeployment`),
    );

    new CfnOutput(this, 'DistributionDomainName', {
      value: this.cloudFrontDistribution.domainName,
    });
    new CfnOutput(this, `${websiteName}WebsiteBucketName`, {
      value: this.websiteBucket.bucketName,
    });
  }
}

export class CloudfrontWebAcl extends Stack {
  public readonly wafArn;
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: {
        region: 'us-east-1',
        account: Stack.of(scope).account,
      },
      crossRegionReferences: true,
    });

    this.wafArn = new CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: id,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'CRSRule',
          priority: 0,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesCommonRuleSet',
              vendorName: 'AWS',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'MetricForWebACLCDK-CRS',
            sampledRequestsEnabled: true,
          },
          overrideAction: {
            none: {},
          },
        },
        {
          name: 'KnownBadInputsRule',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
              vendorName: 'AWS',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'MetricForWebACLCDK-CRS',
            sampledRequestsEnabled: true,
          },
          overrideAction: {
            none: {},
          },
        },
      ],
    }).attrArn;
  }
}
