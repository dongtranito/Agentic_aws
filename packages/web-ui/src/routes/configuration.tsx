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
