import {
  MarketerAgent,
  UserIdentity,
  WebUi,
} from ':play-c463-z26-rzy-mar-tech/common-constructs';
import { IDeploymentConfig } from ':play-c463-z26-rzy-mar-tech/types';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { APIConstruct } from '../constructs/api.js';

export interface ApplicationStackProps extends StackProps {
  readonly deploymentConfig: IDeploymentConfig;
}

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const { deploymentConfig } = props;

    // The code that defines your stack goes here

    const identity = new UserIdentity(this, 'UserIdentity', {
      adminUser: deploymentConfig.adminUser,
    });

    const api = new APIConstruct(this, 'ApiConstruct', {
      userPool: identity.userPool,
    });

    new MarketerAgent(this, 'Agent');

    const web = new WebUi(this, 'WebUi');

    web.bucketDeployment.node.addDependency(api.restAPI);
  }
}
