// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { useContext } from 'react';
import { ApiContext, ApiClient } from '../components/ApiClientProvider';

export const useApi = (): ApiClient => {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi must be used within ApiClientProvider');
  }
  return client;
};
