import { Construct } from 'constructs';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Function } from 'aws-cdk-lib/aws-lambda';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi as CdkRestApi,
  Stage,
} from 'aws-cdk-lib/aws-apigateway';
import {
  PolicyDocument,
  PolicyStatement,
  Effect,
  AnyPrincipal,
  IGrantable,
  Grant,
} from 'aws-cdk-lib/aws-iam';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { RuntimeConfig } from '../../core/runtime-config.js';
import { suppressRules } from '../../core/checkov.js';

/**
 * Integration configuration for an API endpoint
 */
export interface ApiIntegration {
  handler: Function;
  integration: LambdaIntegration;
}

/**
 * Properties for creating the Api construct
 */
export interface ApiProps {
  /**
   * Identity details for Cognito Authentication
   */
  identity: {
    userPool: IUserPool;
  };
  /**
   * Lambda handler for GET /campaign/:id
   */
  getCampaign: ApiIntegration;
  /**
   * Lambda handler for GET /campaign
   */
  getCampaigns: ApiIntegration;
  /**
   * Lambda handler for POST /campaign
   */
  createCampaign: ApiIntegration;
  /**
   * Lambda handler for PUT /chat (streaming)
   */
  putChat: ApiIntegration;
  /**
   * Lambda handler for GET /chat/:sessionId
   */
  getChatHistory: ApiIntegration;
}

/**
 * A CDK construct that creates a simple REST API with two endpoints:
 * - GET /campaign/:id - Get campaign details
 * - PUT /chat - Streaming chat endpoint
 */
export class Api extends Construct {
  public readonly api: CdkRestApi;
  public readonly getCampaignHandler: Function;
  public readonly getCampaignsHandler: Function;
  public readonly createCampaignHandler: Function;
  public readonly putChatHandler: Function;
  public readonly getChatHistoryHandler: Function;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const {
      identity,
      getCampaign,
      getCampaigns,
      createCampaign,
      putChat,
      getChatHistory,
    } = props;

    this.getCampaignHandler = getCampaign.handler;
    this.getCampaignsHandler = getCampaigns.handler;
    this.createCampaignHandler = createCampaign.handler;
    this.putChatHandler = putChat.handler;
    this.getChatHistoryHandler = getChatHistory.handler;

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [identity.userPool],
    });

    this.api = new CdkRestApi(this, 'Api', {
      restApiName: 'Api',
      defaultMethodOptions: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
      deployOptions: {
        tracingEnabled: true,
      },
      policy: new PolicyDocument({
        statements: [
          // Allow all requests - Cognito authorizer handles authentication
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
          }),
        ],
      }),
    });

    suppressRules(
      this.api,
      ['CKV_AWS_120'],
      'Caching not required for this use case',
      (c) => c instanceof Stage,
    );
    suppressRules(
      this.api,
      ['CKV_AWS_76'],
      'API Gateway access logging disabled due to account-level CloudWatch Logs role ARN requirement',
      (c) => c instanceof Stage,
    );

    // GET /campaign, POST /campaign, GET /campaign/{id}
    const campaignResource = this.api.root.addResource('campaign');
    campaignResource.addMethod('GET', getCampaigns.integration);
    campaignResource.addMethod('POST', createCampaign.integration);
    const campaignIdResource = campaignResource.addResource('{id}');
    campaignIdResource.addMethod('GET', getCampaign.integration);

    // PUT /chat, GET /chat/{sessionId}
    const chatResource = this.api.root.addResource('chat');
    chatResource.addMethod('PUT', putChat.integration);
    const chatSessionResource = chatResource.addResource('{sessionId}');
    chatSessionResource.addMethod('GET', getChatHistory.integration);

    // Register the API URL in runtime configuration
    RuntimeConfig.ensure(this).config.apis = {
      ...RuntimeConfig.ensure(this).config.apis!,
      Api: this.api.url!,
    };
  }

  /**
   * Restricts CORS to the website CloudFront distribution domains
   */
  public restrictCorsTo(
    ...websites: { cloudFrontDistribution: Distribution }[]
  ) {
    const allowedOrigins = websites
      .map(
        ({ cloudFrontDistribution }) =>
          `https://${cloudFrontDistribution.distributionDomainName}`,
      )
      .join(',');

    this.getCampaignHandler.addEnvironment('ALLOWED_ORIGINS', allowedOrigins);
    this.getCampaignsHandler.addEnvironment('ALLOWED_ORIGINS', allowedOrigins);
    this.createCampaignHandler.addEnvironment(
      'ALLOWED_ORIGINS',
      allowedOrigins,
    );
    this.putChatHandler.addEnvironment('ALLOWED_ORIGINS', allowedOrigins);
    this.getChatHistoryHandler.addEnvironment(
      'ALLOWED_ORIGINS',
      allowedOrigins,
    );
  }

  /**
   * Grants IAM permissions to invoke any method on this API.
   */
  public grantInvokeAccess(grantee: IGrantable) {
    this.api.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [grantee.grantPrincipal],
        actions: ['execute-api:Invoke'],
        resources: ['execute-api:/*'],
      }),
    );

    Grant.addToPrincipal({
      grantee,
      actions: ['execute-api:Invoke'],
      resourceArns: [this.api.arnForExecuteApi('*', '/*', '*')],
    });
  }
}
