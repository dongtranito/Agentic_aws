import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Header,
  Table,
  Box,
  SpaceBetween,
  Button,
  Spinner,
  Link,
  Pagination,
  CollectionPreferences,
} from '@cloudscape-design/components';
import type { ICampaignListItem } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../../hooks/useApi';
import { useNavigate } from '@tanstack/react-router';
import { CreateCampaignModal } from '../CreateCampaignModal';

const PAGE_SIZE_OPTIONS = [
  { value: 5, label: '5 campaigns' },
  { value: 10, label: '10 campaigns' },
  { value: 25, label: '25 campaigns' },
  { value: 50, label: '50 campaigns' },
];

export const CampaignsList = () => {
  const [campaigns, setCampaigns] = useState<ICampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [tokenHistory, setTokenHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const api = useApi();
  const navigate = useNavigate();

  const fetchCampaigns = useCallback(
    async (token?: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.campaign.list({
          pageSize,
          nextToken: token,
        });
        setCampaigns(response.campaigns);
        setNextToken(response.nextToken);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load campaigns',
        );
      } finally {
        setLoading(false);
      }
    },
    [api, pageSize],
  );

  useEffect(() => {
    setCurrentPageIndex(1);
    setTokenHistory([undefined]);
    fetchCampaigns();
  }, [pageSize, fetchCampaigns]);

  const handlePageChange = (pageIndex: number) => {
    if (pageIndex > currentPageIndex && nextToken) {
      // Going forward
      setTokenHistory((prev) => [...prev, nextToken]);
      setCurrentPageIndex(pageIndex);
      fetchCampaigns(nextToken);
    } else if (pageIndex < currentPageIndex) {
      // Going backward
      const newHistory = tokenHistory.slice(0, pageIndex);
      setTokenHistory(newHistory);
      setCurrentPageIndex(pageIndex);
      fetchCampaigns(newHistory[pageIndex - 1]);
    }
  };

  const handleRefresh = () => {
    setCurrentPageIndex(1);
    setTokenHistory([undefined]);
    fetchCampaigns();
  };

  return (
    <>
      <Container
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  onClick={handleRefresh}
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
            loading={loading}
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
            pagination={
              <Pagination
                currentPageIndex={currentPageIndex}
                pagesCount={nextToken ? currentPageIndex + 1 : currentPageIndex}
                onChange={({ detail }) =>
                  handlePageChange(detail.currentPageIndex)
                }
                openEnd={!!nextToken}
              />
            }
            preferences={
              <CollectionPreferences
                title="Preferences"
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                preferences={{ pageSize }}
                pageSizePreference={{
                  title: 'Page size',
                  options: PAGE_SIZE_OPTIONS,
                }}
                onConfirm={({ detail }) => {
                  if (detail.pageSize) setPageSize(detail.pageSize);
                }}
              />
            }
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
