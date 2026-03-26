// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/campaign/')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
