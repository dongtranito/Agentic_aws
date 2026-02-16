import { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Table,
  Box,
  SpaceBetween,
  Button,
  Spinner,
} from '@cloudscape-design/components';
import type { ICampaignOutput } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../../hooks/useApi';

export const CampaignsList = () => {
  const [campaigns, setCampaigns] = useState<ICampaignOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.campaign.list();
      setCampaigns(response.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <Container
      header={
        <Header
          actions={
            <Button
              iconName="refresh"
              onClick={fetchCampaigns}
              loading={loading}
            >
              Refresh
            </Button>
          }
        >
          Campaigns
        </Header>
      }
    >
      {loading && !campaigns.length ? (
        <Box textAlign="center" padding="l">
          <Spinner /> Loading campaigns...
        </Box>
      ) : error ? (
        <Box textAlign="center" color="text-status-error" padding="l">
          {error}
        </Box>
      ) : (
        <Table
          items={campaigns}
          columnDefinitions={[
            {
              id: 'id',
              header: 'ID',
              cell: (item) => item.id,
            },
            {
              id: 'name',
              header: 'Name',
              cell: (item) => item.name,
            },
          ]}
          empty={
            <Box textAlign="center" padding="l">
              <SpaceBetween size="m">
                <b>No campaigns</b>
                <Box variant="p" color="inherit">
                  No campaigns have been created yet.
                </Box>
              </SpaceBetween>
            </Box>
          }
        />
      )}
    </Container>
  );
};

export default CampaignsList;
