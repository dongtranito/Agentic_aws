import { Construct } from 'constructs';
import * as url from 'url';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import {
  Code,
  Runtime,
  Function,
  FunctionProps,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
} from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib';
import {
  PolicyDocument,
  PolicyStatement,
  Effect,
  AnyPrincipal,
  IGrantable,
  Grant,
} from 'aws-cdk-lib/aws-iam';
import {
  IntegrationBuilder,
  RestApiIntegration,
} from '../../core/api/utils.js';
import { RestApi } from '../../core/api/rest-api.js';
import { Procedures, routerToOperations } from '../../core/api/trpc-utils.js';
import { AppRouter, appRouter } from ':play-c463-z26-rzy-mar-tech/api';

// String union type for all API operation names
type Operations = Procedures<AppRouter>;

/**
 * Properties for creating a Api construct
 *
 * @template TIntegrations - Map of operation names to their integrations
 */
export interface ApiProps<
  TIntegrations extends Record<Operations, RestApiIntegration>,
> {
  /**
   * Map of operation names to their API Gateway integrations
   */
  integrations: TIntegrations;
}

/**
 * A CDK construct that creates and configures an AWS API Gateway REST API
 * specifically for Api.
 * @template TIntegrations - Map of operation names to their integrations
 */
export class Api<
  TIntegrations extends Record<Operations, RestApiIntegration>,
> extends RestApi<Operations, TIntegrations> {
  /**
   * Creates default integrations for all operations, which implement each operation as
   * its own individual lambda function.
   *
   * @param scope - The CDK construct scope
   * @returns An IntegrationBuilder with default lambda integrations
   */
  public static defaultIntegrations = (scope: Construct) => {
    return IntegrationBuilder.rest({
      operations: routerToOperations(appRouter),
      defaultIntegrationOptions: {
        runtime: Runtime.NODEJS_LATEST,
        handler: 'index.handler',
        code: Code.fromAsset(
          url.fileURLToPath(
            new URL(
              '../../../../../../dist/packages/api/bundle',
              import.meta.url,
            ),
          ),
        ),
        timeout: Duration.seconds(30),
        tracing: Tracing.ACTIVE,
        environment: {
          AWS_CONNECTION_REUSE_ENABLED: '1',
        },
      } satisfies FunctionProps,
      buildDefaultIntegration: (op, props: FunctionProps) => {
        const handler = new Function(scope, `Api${op}Handler`, props);
        return { handler, integration: new LambdaIntegration(handler) };
      },
    });
  };

  constructor(scope: Construct, id: string, props: ApiProps<TIntegrations>) {
    super(scope, id, {
      apiName: 'Api',
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      deployOptions: {
        tracingEnabled: true,
      },
      policy: new PolicyDocument({
        statements: [
          // Open up OPTIONS to allow browsers to make unauthenticated preflight requests
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/OPTIONS/*'],
          }),
        ],
      }),
      operations: routerToOperations(appRouter),
      ...props,
    });
  }

  /**
   * Restricts CORS to the website CloudFront distribution domains
   *
   * Configures the CloudFront distribution domains as the only permitted CORS origins
   * (other than local host) in the AWS Lambda integrations
   *
   * Note that this restriction is not applied to preflight OPTIONS
   *
   * @param websites - The CloudFront distribution to grant CORS from
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

    // Set ALLOWED_ORIGINS environment variable for all Lambda integrations
    Object.values(this.integrations).forEach((integration) => {
      if ('handler' in integration && integration.handler instanceof Function) {
        integration.handler.addEnvironment('ALLOWED_ORIGINS', allowedOrigins);
      }
    });
  }

  /**
   * Grants IAM permissions to invoke any method on this API.
   *
   * @param grantee - The IAM principal to grant permissions to
   */
  public grantInvokeAccess(grantee: IGrantable) {
    // Here we grant grantee permission to call the api.
    // Machine to machine fine-grained access can be defined here using more specific principals (eg roles or
    // users) and resources (eg which api paths may be invoked by which principal) if required.
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
