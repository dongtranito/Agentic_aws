// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { ContentLayout, Header } from '@cloudscape-design/components';
import { createFileRoute } from '@tanstack/react-router';
import { Configuration } from '../components/Configuration';

export const Route = createFileRoute('/configuration')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ContentLayout header={<Header>Agent Configuration</Header>}>
      <Configuration />
    </ContentLayout>
  );
}
