import { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Grid,
  Container,
  Box,
  SpaceBetween,
  Spinner,
  KeyValuePairs,
  Button,
} from '@cloudscape-design/components';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { IGetCampaignOutput } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../hooks/useApi';
import { Chat } from '../components/Chat';

export const Route = createFileRoute('/campaign/$id')({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const [campaign, setCampaign] = useState<IGetCampaignOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.campaign.get(id);
        setCampaign(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load campaign',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [id]);

  if (loading) {
    return (
      <ContentLayout header={<Header>Loading...</Header>}>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (error || !campaign) {
    return (
      <ContentLayout header={<Header>Error</Header>}>
        <Container>
          <Box textAlign="center" padding="l" color="text-status-error">
            {error || 'Campaign not found'}
          </Box>
        </Container>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          actions={
            <Button onClick={() => navigate({ to: '/' })}>
              Back to Campaigns
            </Button>
          }
        >
          {campaign.name}
        </Header>
      }
    >
      <Grid
        gridDefinition={[
          { colspan: { default: 12, m: 8 } },
          { colspan: { default: 12, m: 4 } },
        ]}
      >
        <Container header={<Header>Campaign Details</Header>}>
          <SpaceBetween size="l">
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'ID', value: campaign.id },
                { label: 'Name', value: campaign.name },
                {
                  label: 'Created',
                  value: new Date(campaign.createdAt).toLocaleString(),
                },
                {
                  label: 'Updated',
                  value: new Date(campaign.updatedAt).toLocaleString(),
                },
              ]}
            />
          </SpaceBetween>
        </Container>
        <Chat campaignId={id} />
      </Grid>
    </ContentLayout>
  );
}
