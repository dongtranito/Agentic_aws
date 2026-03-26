// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
export type ApiUrl = string;
/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
export interface ICognitoProps {
  region: string;
  identityPoolId: string;
  userPoolId: string;
  userPoolWebClientId: string;
}
export interface IRuntimeConfig {
  cognitoProps: ICognitoProps;
  apis: {
    Api: ApiUrl;
  };
}
