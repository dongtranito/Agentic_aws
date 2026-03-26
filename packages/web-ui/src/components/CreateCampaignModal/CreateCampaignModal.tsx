// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Input,
} from '@cloudscape-design/components';
import type { InputProps } from '@cloudscape-design/components/input';
import { useApi } from '../../hooks/useApi';
import { useNavigate } from '@tanstack/react-router';

interface CreateCampaignModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const CreateCampaignModal = ({
  visible,
  onDismiss,
}: CreateCampaignModalProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const navigate = useNavigate();
  const inputRef = useRef<InputProps.Ref>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const campaign = await api.campaign.create({ name: name.trim() });
      onDismiss();
      setName('');
      navigate({ to: '/campaign/$id', params: { id: campaign.id } });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create campaign',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setName('');
    setError(null);
    onDismiss();
  };

  const handleKeyDown = (event: CustomEvent<{ key: string }>) => {
    if (event.detail.key === 'Enter' && name.trim() && !loading) {
      handleSubmit();
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      header="Create Campaign"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Campaign Name" errorText={error}>
          <Input
            ref={inputRef}
            value={name}
            onChange={({ detail }) => setName(detail.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter campaign name"
            disabled={loading}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};

export default CreateCampaignModal;
