# Databricks Agent

The Databricks Agent is a worker agent that provides data analytics capabilities. It connects to Databricks tools exposed through the AgentCore MCP Gateway and is invoked by the Marketing Agent during the audience definition step.

## Location

[`packages/agents/databricks/`](../../packages/agents/databricks/)

## Technology Stack

- Python with FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime (containerized on ECS)
- Shared A2A server factory from [`packages/agents/common`](../../packages/agents/common/)

## Entry Point

[`app/agent/main.py`](../../packages/agents/databricks/app/agent/main.py)

Uses the shared `create_a2a_app()` factory from [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) to create a FastAPI application that serves the agent over the A2A protocol. The factory wraps the agent in a Strands `A2AServer` and mounts it on a FastAPI app with a `/ping` health check.

## Agent Definition

[`app/agent/agent.py`](../../packages/agents/databricks/app/agent/agent.py)

The `get_databricks_agent()` function creates a Strands Agent with:

- **MCP Gateway client** — connects to the `databricks-target` on the AgentCore Gateway using SigV4-authenticated streamable HTTP. Tools are filtered by the `databricks-target___` prefix.
- **Built-in tools** — `current_time` from `strands_tools`.
- **Dynamic configuration** — loads model ID and system prompt from SSM Parameter Store.

## Available Tools

The agent has access to eight tools exposed by the Databricks MCP Server:

| Tool                   | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `execute_sql`          | Execute SQL queries against a Databricks SQL warehouse  |
| `get_statement_result` | Poll for results of long-running SQL statements         |
| `list_warehouses`      | List available SQL warehouses to discover warehouse IDs |
| `list_schemas`         | List schemas in a Unity Catalog catalog                 |
| `list_tables`          | List tables in a Unity Catalog schema                   |
| `get_table`            | Get table details including column names and types      |
| `run_job`              | Trigger a Databricks job run                            |
| `get_job_run`          | Check the status of a Databricks job run                |

## Workflow Guidelines

The agent's system prompt instructs it to:

1. Use `list_warehouses` to find an available warehouse if none is provided.
2. Use `list_schemas` and `list_tables` to discover data before writing queries.
3. Use `get_table` to understand column names and types before constructing SQL.
4. For SQL queries, use `execute_sql` and poll with `get_statement_result` if the result is pending.
5. Inform the user about the S3 location of full results when truncated.

## Environment Variables

- `GATEWAY_URL` — AgentCore MCP Gateway URL
- `AGENT_CONFIG_PARAMETER` — SSM parameter name for agent configuration
- `AWS_REGION` — AWS region
