// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { ApplicationStage } from './stages/application-stage.js';
import { App } from ':play-c463-z26-rzy-mar-tech/common-constructs';
import { loadDeploymentConfig } from './utils/config-loader.js';

const app = new App();

const deploymentConfig = loadDeploymentConfig();

// Use this to deploy your own sandbox environment (assumes your CLI credentials)
// [VI] Dùng đoạn này để triển khai môi trường sandbox riêng của bạn (giả định dùng thông tin xác thực từ CLI)
new ApplicationStage(app, 'play-c463-z26-rzy-mar-tech-infra-sandbox', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  deploymentConfig,
});

app.synth();
