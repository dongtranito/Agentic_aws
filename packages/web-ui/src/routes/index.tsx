import { ContentLayout, Header } from '@cloudscape-design/components';
import { createFileRoute } from '@tanstack/react-router';
import { CampaignsList } from '../components/CampaignsList';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ContentLayout header={<Header>Marketing Agent</Header>}>
      <CampaignsList />
    </ContentLayout>
  );
}
