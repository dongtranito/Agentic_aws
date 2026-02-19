import {
  UserIdentity,
  WebUi,
} from ':play-c463-z26-rzy-mar-tech/common-constructs';
import { IDeploymentConfig } from ':play-c463-z26-rzy-mar-tech/types';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { APIConstruct } from '../constructs/api.js';
import { AgentConstruct } from '../constructs/agent.js';
import { GatewayConstruct } from '../constructs/gateway.js';
import { StorageAndData } from '../constructs/storage-data.js';

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

    const storage = new StorageAndData(this, 'StorageAndData');
    const gateway = new GatewayConstruct(this, 'Gateway');
    const agents = new AgentConstruct(this, 'Agents', {
      gateway: gateway.gateway,
    });
    const api = new APIConstruct(this, 'ApiConstruct', {
      userPool: identity.userPool,
      campaignsTable: storage.campaigns,
      campaignActiveIndex: storage.taskActiveIndex,
      sessionsBucket: storage.sessionsBucket,
      marketerAgent: agents.marketer,
      memory: agents.memory,
    });

    const web = new WebUi(this, 'WebUi');

    web.bucketDeployment.node.addDependency(api.restAPI);
  }
}
