import { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Table,
  Box,
  SpaceBetween,
  Button,
  Spinner,
  Link,
} from '@cloudscape-design/components';
import type { ICampaignListItem } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../../hooks/useApi';
import { useNavigate } from '@tanstack/react-router';
import { CreateCampaignModal } from '../CreateCampaignModal';

export const CampaignsList = () => {
  const [campaigns, setCampaigns] = useState<ICampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const api = useApi();
  const navigate = useNavigate();

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
    <>
      <Container
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  onClick={fetchCampaigns}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Campaign
                </Button>
              </SpaceBetween>
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
            variant="embedded"
            items={campaigns}
            columnDefinitions={[
              {
                id: 'id',
                header: 'ID',
                cell: (item) => item.id,
                width: 350,
              },
              {
                id: 'name',
                header: 'Name',
                cell: (item) => item.name,
              },
              {
                id: 'createdAt',
                header: 'Created At',
                cell: (item) => new Date(item.createdAt).toLocaleString(),
              },
              {
                id: 'updatedAt',
                header: 'Updated At',
                cell: (item) => new Date(item.updatedAt).toLocaleString(),
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (item) => (
                  <Link
                    onFollow={(e) => {
                      e.preventDefault();
                      navigate({
                        to: '/campaign/$id',
                        params: { id: item.id },
                      });
                    }}
                  >
                    Details
                  </Link>
                ),
              },
            ]}
            empty={
              <Box textAlign="center" padding="l">
                <SpaceBetween size="m">
                  <b>No campaigns</b>
                  <Box variant="p" color="inherit">
                    No campaigns have been created yet.
                  </Box>
                  <Button onClick={() => setShowCreateModal(true)}>
                    Create Campaign
                  </Button>
                </SpaceBetween>
              </Box>
            }
          />
        )}
      </Container>
      <CreateCampaignModal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
      />
    </>
  );
};

export default CampaignsList;
