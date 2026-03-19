# Marketing Agent

The Marketing Agent is the central orchestrator of the platform. It guides users through a structured three-step campaign creation workflow by delegating tasks to three specialist worker agents via Agent-to-Agent (A2A) communication.

## Location

[`packages/agents/marketer/`](../../packages/agents/marketer/)

## Technology Stack

- Python with FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- AgentCore Memory for session persistence

## Entry Point

[`app/agent/main.py`](../../packages/agents/marketer/app/agent/main.py)

The Marketing Agent is served differently from the worker agents. Instead of using the shared `create_a2a_app` factory, it defines a custom FastAPI application with a `/invocations` endpoint (required by AgentCore Runtime) and a `/ping` health check. The `/invocations` endpoint parses the incoming payload, extracts the prompt and actor ID, and returns a `StreamingResponse` with SSE-formatted events.

## Agent Definition

[`app/agent/agent.py`](../../packages/agents/marketer/app/agent/agent.py)

The `get_agent()` function is a context manager that creates a fully configured Strands Agent with:

- **AgentCore Memory** — configured via `AgentCoreMemoryConfig` and `AgentCoreMemorySessionManager` for session persistence across conversations.
- **Worker agent tools** — three A2A tool wrappers (`databricks_agent`, `clevertap_agent`, `talonone_agent`) built from the respective AgentCore Runtime ARNs.
- **Built-in tools** — `current_time` from `strands_tools`.
- **S3 Artifact Hook** — registers a hook that saves every conversation message to S3 for archival and audit.
- **Dynamic configuration** — loads model ID and system prompt from SSM Parameter Store at invocation time.

## Workflow

The agent's system prompt enforces a strict three-step workflow:

1. **Define Target Audience** — Uses `databricks_agent` to explore tags, user properties, and run SQL queries to estimate audience size. Requires explicit user confirmation before proceeding.
2. **Create Campaign in CleverTap** — Uses `clevertap_agent` to create a draft campaign with the confirmed audience targeting, present estimated reach, and finalize upon user confirmation.
3. **Create Promotion in TalonOne (Optional)** — Uses `talonone_agent` to set up a promotion campaign if the user opts in.

The agent refuses to help with anything outside this workflow.

## Worker Agent Tools

Located in [`app/agent/worker_agents/`](../../packages/agents/marketer/app/agent/worker_agents/):

Each worker agent tool is built using the `build_*_tool()` factory functions. These create Strands `@tool`-decorated async generators that delegate to remote agents via A2A streaming:

- [`build_databricks_tool()`](../../packages/agents/marketer/app/agent/worker_agents/databricks.py) — wraps the Databricks Agent
- [`build_clevertap_tool()`](../../packages/agents/marketer/app/agent/worker_agents/clevertap.py) — wraps the CleverTap Agent
- [`build_talonone_tool()`](../../packages/agents/marketer/app/agent/worker_agents/talonone.py) — wraps the TalonOne Agent

Each tool accepts a natural language `request` string and yields `SubAgentProgress` events as the remote agent streams its response.

## A2A Communication

Located in [`app/agent/utils/a2a.py`](../../packages/agents/marketer/app/agent/utils/a2a.py):

The A2A utility module handles communication with worker agents deployed on AgentCore Runtime:

- `build_a2a_agent()` — constructs a Strands `A2AAgent` with SigV4-authenticated HTTPX client, fetches the agent card via boto3, and builds the endpoint URL from the agent's ARN.
- `stream_a2a_agent()` — async generator that streams progress from a remote agent, yielding `SubAgentProgress` events for intermediate updates and the final response string as the last item.

## S3 Artifact Hook

Located in [`app/agent/hooks/s3_artifact.py`](../../packages/agents/marketer/app/agent/hooks/s3_artifact.py):

The `S3ArtifactHook` saves conversation messages to S3 following the Strands `FileSessionManager` directory structure:

```
/<bucket>/<session_id>/agents/agent_marketer/messages/message_0.json
```

It registers a `MessageAddedEvent` callback with the agent's hook registry. This is write-only — session restoration is handled by AgentCore Memory.

## SSE Event Format

The streaming handler emits four types of SSE events:

- `{"type": "text", "content": "..."}` — text chunks from the agent
- `{"type": "tool_use", "name": "...", "input": {...}}` — when a tool invocation starts
- `{"type": "tool_result", "name": "...", "status": "...", "output": "..."}` — when a tool completes
- `{"type": "subagent_progress", "agent": "...", "content": "..."}` — intermediate streaming from worker agents

## Environment Variables

- `MEMORY_ID` — AgentCore Memory resource ID
- `AWS_REGION` — AWS region
- `DATABRICKS_A2A_ENDPOINT` — Databricks Agent Runtime ARN
- `CLEVERTAP_A2A_ENDPOINT` — CleverTap Agent Runtime ARN
- `TALONONE_A2A_ENDPOINT` — TalonOne Agent Runtime ARN
- `GATEWAY_URL` — AgentCore MCP Gateway URL
- `ARTIFACT_BUCKET` — S3 bucket for conversation artifacts
- `AGENT_CONFIG_PARAMETER` — SSM parameter name for agent configuration
