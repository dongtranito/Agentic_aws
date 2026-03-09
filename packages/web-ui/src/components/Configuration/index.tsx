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
  Textarea,
} from '@cloudscape-design/components';
import type { IAgentName } from ':play-c463-z26-rzy-mar-tech/api';
import { useApi } from '../../hooks/useApi';

const AGENTS: { name: IAgentName; label: string }[] = [
  { name: 'marketer', label: 'Marketer Agent - Supervisor' },
  { name: 'databricks', label: 'Databricks Agent - Subagent' },
  { name: 'talonone', label: 'TalonOne Agent - Subagent' },
  { name: 'clevertap', label: 'CleverTap Agent - Subagent' },
];

interface AgentConfigState {
  modelId: string;
  systemPrompt: string;
  dirty: boolean;
}

export const Configuration = () => {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<SelectProps.Option[]>([]);
  const [configs, setConfigs] = useState<Record<IAgentName, AgentConfigState>>({
    marketer: { modelId: '', systemPrompt: '', dirty: false },
    databricks: { modelId: '', systemPrompt: '', dirty: false },
    talonone: { modelId: '', systemPrompt: '', dirty: false },
    clevertap: { modelId: '', systemPrompt: '', dirty: false },
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

      const newConfigs = {} as Record<IAgentName, AgentConfigState>;
      AGENTS.forEach((agent, i) => {
        newConfigs[agent.name] = {
          modelId: configResults[i].config.modelId || '',
          systemPrompt: configResults[i].config.systemPrompt || '',
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

  const handleSystemPromptChange = (
    agentName: IAgentName,
    systemPrompt: string,
  ) => {
    setConfigs((prev) => ({
      ...prev,
      [agentName]: { ...prev[agentName], systemPrompt, dirty: true },
    }));
  };

  const hasDirtyConfigs = AGENTS.some((a) => configs[a.name].dirty);

  const handleSaveAll = async () => {
    setSaving(true);
    const dirtyAgents = AGENTS.filter((a) => configs[a.name].dirty);
    const errors: string[] = [];

    await Promise.all(
      dirtyAgents.map(async (agent) => {
        try {
          await api.configuration.putAgentConfig(agent.name, {
            modelId: configs[agent.name].modelId,
            systemPrompt: configs[agent.name].systemPrompt,
          });
          setConfigs((prev) => ({
            ...prev,
            [agent.name]: { ...prev[agent.name], dirty: false },
          }));
        } catch {
          errors.push(agent.label);
        }
      }),
    );

    setSaving(false);

    if (errors.length > 0) {
      setFlash([
        {
          type: 'error',
          content: `Failed to save configuration for: ${errors.join(', ')}`,
          id: `save-error-${Date.now()}`,
        },
      ]);
    } else {
      setFlash([
        {
          type: 'success',
          content: `Configuration saved for ${dirtyAgents.map((a) => a.label).join(', ')}`,
          id: `save-success-${Date.now()}`,
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
      <Header>Agent Configuration</Header>
      <ColumnLayout columns={2}>
        {AGENTS.map((agent) => (
          <Container key={agent.name} header={<Header>{agent.label}</Header>}>
            <SpaceBetween size="m">
              <FormField
                label="Model"
                description="Select the Bedrock model for this agent"
                stretch
              >
                <Select
                  selectedOption={
                    models.find(
                      (m) => m.value === configs[agent.name].modelId,
                    ) ?? null
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
              <FormField
                label="System Prompt"
                description="Custom system prompt for this agent (leave empty to use default)"
                stretch
              >
                <Textarea
                  value={configs[agent.name].systemPrompt}
                  onChange={({ detail }) =>
                    handleSystemPromptChange(agent.name, detail.value)
                  }
                  placeholder="Enter a custom system prompt..."
                  rows={8}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        ))}
      </ColumnLayout>
      <Box float="right">
        <Button
          variant="primary"
          loading={saving}
          disabled={!hasDirtyConfigs}
          onClick={handleSaveAll}
        >
          Save
        </Button>
      </Box>
    </SpaceBetween>
  );
};
