import {
  ContentLayout,
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import { createFileRoute } from '@tanstack/react-router';
import { Chat } from '../components/Chat';
import { CampaignsList } from '../components/CampaignsList';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ContentLayout header={<Header>Marketing Agent</Header>}>
      <SpaceBetween size="l">
        <CampaignsList />
        <Chat />
      </SpaceBetween>
    </ContentLayout>
  );
}
