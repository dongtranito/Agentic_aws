// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { createRootRouteWithContext } from '@tanstack/react-router';
import AppLayout from '../components/AppLayout';
import { RouterProviderContext } from '../main';
import { Outlet } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<RouterProviderContext>()({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
