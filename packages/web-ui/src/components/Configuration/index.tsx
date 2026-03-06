import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Spinner,
  Select,
  FormField,
  Flashbar,
  ColumnLayout,
  Box,
  SelectProps,
} from '@cloudscape-design/components';
import type { IAgentName } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../../hooks/useApi';

const AGENTS: { name: IAgentName; label: string }[] = [
  { name: 'marketer', label: 'Marketer Agent' },
  { name: 'databricks', label: 'Databricks Agent' },
  { name: 'talonone', label: 'TalonOne Agent' },
  { name: 'clevertap', label: 'CleverTap Agent' },
];

interface AgentConfigState {
  modelId: string;
  saving: boolean;
  dirty: boolean;
}

export const Configuration = () => {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<SelectProps.Option[]>([]);
  const [configs, setConfigs] = useState<Record<IAgentName, AgentConfigState>>({
    marketer: { modelId: '', saving: false, dirty: false },
    databricks: { modelId: '', saving: false, dirty: false },
    talonone: { modelId: '', saving: false, dirty: false },
    clevertap: { modelId: '', saving: false, dirty: false },
  });
  const [flash, setFlash] = useState<
    { type: 'success' | 'error'; content: string; id: string }[]
  >([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, ...configResults] = await Promise.all([
        api.configuration.listModels(),
        ...AGENTS.map((a) => api.configuration.getAgentConfig(a.name)),
      ]);

      setModels(
        modelsRes.models.map((m) => ({
          label: `${m.modelName} (${m.providerName})`,
          value: m.modelId,
          description: m.modelId,
        })),
      );

      const newConfigs = { ...configs };
      AGENTS.forEach((agent, i) => {
        newConfigs[agent.name] = {
          modelId: configResults[i].config.modelId || '',
          saving: false,
          dirty: false,
        };
      });
      setConfigs(newConfigs);
    } catch (err) {
      setFlash([
        {
          type: 'error',
          content:
            err instanceof Error ? err.message : 'Failed to load configuration',
          id: 'load-error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModelChange = (agentName: IAgentName, modelId: string) => {
    setConfigs((prev) => ({
      ...prev,
      [agentName]: { ...prev[agentName], modelId, dirty: true },
    }));
  };

  const handleSave = async (agentName: IAgentName) => {
    setConfigs((prev) => ({
      ...prev,
      [agentName]: { ...prev[agentName], saving: true },
    }));
    try {
      await api.configuration.putAgentConfig(agentName, {
        modelId: configs[agentName].modelId,
      });
      setConfigs((prev) => ({
        ...prev,
        [agentName]: { ...prev[agentName], saving: false, dirty: false },
      }));
      setFlash([
        {
          type: 'success',
          content: `Configuration saved for ${AGENTS.find((a) => a.name === agentName)?.label}`,
          id: `save-${agentName}-${Date.now()}`,
        },
      ]);
    } catch (err) {
      setConfigs((prev) => ({
        ...prev,
        [agentName]: { ...prev[agentName], saving: false },
      }));
      setFlash([
        {
          type: 'error',
          content: `Failed to save configuration for ${agentName}`,
          id: `save-error-${agentName}-${Date.now()}`,
        },
      ]);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box textAlign="center" padding="l">
          <Spinner size="large" />
        </Box>
      </Container>
    );
  }

  return (
    <SpaceBetween size="l">
      <Flashbar
        items={flash.map((f) => ({
          ...f,
          dismissible: true,
          onDismiss: () =>
            setFlash((prev) => prev.filter((i) => i.id !== f.id)),
        }))}
      />
      <ColumnLayout columns={2}>
        {AGENTS.map((agent) => (
          <Container
            key={agent.name}
            header={
              <Header
                actions={
                  <Button
                    variant="primary"
                    loading={configs[agent.name].saving}
                    disabled={!configs[agent.name].dirty}
                    onClick={() => handleSave(agent.name)}
                  >
                    Save
                  </Button>
                }
              >
                {agent.label}
              </Header>
            }
          >
            <FormField
              label="Model"
              description="Select the Bedrock model for this agent"
            >
              <Select
                selectedOption={
                  models.find((m) => m.value === configs[agent.name].modelId) ??
                  null
                }
                onChange={({ detail }) =>
                  handleModelChange(
                    agent.name,
                    detail.selectedOption.value ?? '',
                  )
                }
                options={models}
                filteringType="auto"
                placeholder="Choose a model"
              />
            </FormField>
          </Container>
        ))}
      </ColumnLayout>
    </SpaceBetween>
  );
};
