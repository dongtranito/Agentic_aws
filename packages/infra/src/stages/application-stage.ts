// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplicationStack } from '../stacks/application-stack.js';
import { IDeploymentConfig } from ':play-c463-z26-rzy-mar-tech/types';

export interface ApplicationStageProps extends StageProps {
  readonly deploymentConfig: IDeploymentConfig;
}

/**
 * Defines a collection of CDK Stacks which make up your application
 */
export class ApplicationStage extends Stage {
  constructor(scope: Construct, id: string, props: ApplicationStageProps) {
    super(scope, id, props);

    const { deploymentConfig } = props;

    new ApplicationStack(this, 'Application', {
      crossRegionReferences: true,
      deploymentConfig,
    });
  }
}
