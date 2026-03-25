# Session Persistence & S3 Artifacts

All four agents persist their conversation artifacts to the same S3 session folder, enabling full audit and inspection of the entire multi-agent workflow from a single location.

## S3 Structure

Based on a real session (`session-115d83b0-d13a-436b-af69-63e556b601a9`):

```bash
/<sessions-bucket>/
└── session-115d83b0-d13a-436b-af69-63e556b601a9/
    ├── orchestrator/
    │   ├── agent.json
    │   └── messages/
    │       ├── message_0.json
    │       ├── message_1.json
    │       ...
    ├── databricks-agent/
    │   ├── agent.json
    │   └── messages/
    │       ├── message_0.json
    │       ...
    └── clevertap-agent/
        ├── agent.json
        └── messages/
            ├── message_0.json
            ...
```

In this session the user went through Step 1 (audience definition via Databricks — 26 messages of SQL queries and catalog discovery) and Step 2 (campaign creation via CleverTap — 4 messages for draft and confirm). The TalonOne agent was not invoked as the user skipped the optional promotion step.

## How Session ID Flows

The orchestrator's session ID is passed explicitly through the entire call chain so that all agents write to the same S3 folder.

### Orchestrator Side

1. The Put Chat Lambda invokes the Marketing Agent via AgentCore Runtime with a `sessionId` (e.g. `session-28c0fd0c-...`).

2. [`main.py`](../../packages/agents/marketer/app/agent/main.py) receives the session ID from the `x-amzn-bedrock-agentcore-runtime-session-id` header and sets the `current_session_id` context variable (used by the orchestrator's own S3 hook).

3. [`agent.py`](../../packages/agents/marketer/app/agent/agent.py) passes the `session_id` to each worker agent tool builder:

   ```python
   tools = [
       current_time,
       build_databricks_tool(DATABRICKS_A2A_ENDPOINT, REGION, session_id),
       build_clevertap_tool(CLEVERTAP_A2A_ENDPOINT, REGION, session_id),
       build_talonone_tool(TALONONE_A2A_ENDPOINT, REGION, session_id),
   ]
   ```

4. Each [tool builder](../../packages/agents/marketer/app/agent/worker_agents/) captures the `session_id` in its closure and passes it to [`stream_a2a_agent()`](../../packages/agents/marketer/app/agent/utils/a2a.py) on every invocation.

5. `stream_a2a_agent()` passes it to `build_a2a_agent()`, which sets it as the `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` header in the A2A HTTP request to the worker agent's AgentCore Runtime.

### Worker Agent Side

6. The worker agent's FastAPI app includes a [`SessionIdMiddleware`](../../packages/agents/common/common/a2a_server.py) that reads the `x-amzn-bedrock-agentcore-runtime-session-id` header from the incoming request and sets the `current_session_id` context variable.

7. The [`S3ArtifactHook`](../../packages/agents/common/common/s3_artifact.py) (registered on the agent at startup by `create_a2a_app`) reads `current_session_id` on each `MessageAddedEvent` and writes the message to `<session_id>/<agent_id>/messages/message_<n>.json`.

## Shared S3 Artifact Hook

The [`S3ArtifactHook`](../../packages/agents/common/common/s3_artifact.py) in the `common` package is used by all four agents. It is parameterized with an `agent_id` that determines the subfolder name:

| Agent            | `agent_id`         | S3 Path                                   |
| ---------------- | ------------------ | ----------------------------------------- |
| Marketing Agent  | `orchestrator`     | `<session_id>/orchestrator/messages/`     |
| Databricks Agent | `databricks-agent` | `<session_id>/databricks-agent/messages/` |
| CleverTap Agent  | `clevertap-agent`  | `<session_id>/clevertap-agent/messages/`  |
| TalonOne Agent   | `talonone-agent`   | `<session_id>/talonone-agent/messages/`   |

The hook handles:

- Lazy session initialization (creates `agent.json` on first message)
- Message indexing (counts existing messages in S3 to determine the next index)
- Content serialization (converts Strands `ContentBlock` objects to JSON)
- Graceful failure (logs warnings but never blocks agent execution)

## Key Design Decisions

- The session ID is passed explicitly through function parameters from the orchestrator to the worker agents, rather than relying on `contextvars` propagation which may not survive across Strands' internal thread/task boundaries.
- The orchestrator uses the `current_session_id` context variable (set in `main.py`) for its own S3 hook, since it runs in the same async context.
- Worker agents receive the session ID via the AgentCore Runtime session header, which also enables AgentCore Runtime to reuse the same microVM for multiple calls to the same worker within the same conversation.
- The S3 artifacts are write-only. Session restoration is handled by AgentCore Memory, not by reading from S3.
