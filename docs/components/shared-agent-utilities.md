# Shared Agent Utilities

The [`packages/agents/common/`](../../packages/agents/common/) package provides shared Python utilities used by all four agents.

## Location

[`packages/agents/common/common/`](../../packages/agents/common/common/)

## A2A Server Factory

[`common/a2a_server.py`](../../packages/agents/common/common/a2a_server.py)

Provides a reusable factory for creating FastAPI applications that serve Strands agents over the A2A protocol:

- `create_a2a_app(agent_factory)` — accepts a callable that returns a configured Strands Agent. Creates a Strands `A2AServer`, mounts it on a FastAPI app, and adds a `/ping` health check endpoint. The runtime URL is read from the `AGENTCORE_RUNTIME_URL` environment variable (defaults to `http://127.0.0.1:9000/`).
- `run_a2a_server(agent_factory)` — convenience function that creates the app and runs it with uvicorn on `0.0.0.0:9000`.

Used by the Databricks, CleverTap, and TalonOne agents. The Marketing Agent uses a custom server implementation instead.

## Gateway MCP Client

[`common/gateway.py`](../../packages/agents/common/common/gateway.py)

Factory for creating MCP clients that connect to the AgentCore Gateway:

- `get_gateway_mcp_client(target_name)` — creates a Strands `MCPClient` that connects to the gateway via streamable HTTP with SigV4 authentication. Tools are filtered by a regex pattern matching `{target_name}___` to ensure each agent only sees its own tools.
- `SigV4HTTPXAuth` — HTTPX auth class that signs requests with AWS SigV4 for the `bedrock-agentcore` service. Adds the `x-amz-content-sha256` header required by the gateway.

Environment variables:

- `GATEWAY_URL` — AgentCore MCP Gateway URL
- `AWS_REGION` — AWS region (defaults to `us-east-1`)

## Configuration Loader

[`common/config.py`](../../packages/agents/common/common/config.py)

Loads agent configuration from AWS SSM Parameter Store:

- `load_configuration()` — reads the `AGENT_CONFIG_PARAMETER` environment variable to find the SSM parameter name, fetches the JSON value, and returns it as a dict. Returns an empty dict if the parameter is not set, not found, or fails to load. The SSM client is lazily initialized and reused.

The returned config dict typically contains:

- `modelId` — Bedrock model ID or inference profile ID
- `systemPrompt` — custom system prompt override

## SigV4 Auth (Marketing Agent)

[`packages/agents/marketer/app/agent/utils/sigv4_auth.py`](../../packages/agents/marketer/app/agent/utils/sigv4_auth.py)

A standalone SigV4 HTTPX auth class used by the Marketing Agent's A2A client for communicating with worker agent runtimes. Similar to the gateway SigV4 class but without the content hash header, as it targets the `bedrock-agentcore` service for runtime invocations rather than gateway tool calls.
