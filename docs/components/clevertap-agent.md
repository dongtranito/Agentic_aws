# CleverTap Agent

The CleverTap Agent is a worker agent responsible for campaign lifecycle management within CleverTap. It connects to CleverTap tools via the AgentCore MCP Gateway and is invoked by the Marketing Agent during the campaign creation step.

## Location

[`packages/agents/clevertap/`](../../packages/agents/clevertap/)

## Technology Stack

- Python with FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- Shared A2A server factory from [`packages/agents/common`](../../packages/agents/common/)

## Entry Point

[`app/agent/main.py`](../../packages/agents/clevertap/app/agent/main.py)

Uses the shared `create_a2a_app()` factory from [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) to create a FastAPI application served over the A2A protocol.

## Agent Definition

[`app/agent/agent.py`](../../packages/agents/clevertap/app/agent/agent.py)

The `get_clevertap_agent()` function creates a Strands Agent with:

- **MCP Gateway client** — connects to the `clevertap-target` on the AgentCore Gateway using SigV4-authenticated streamable HTTP.
- **Built-in tools** — `current_time` from `strands_tools`.
- **Dynamic configuration** — loads model ID and system prompt from SSM Parameter Store.

## Available Tools

The agent has access to six tools exposed by the CleverTap MCP Server:

| Tool                     | Description                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `create_draft_campaign`  | Validate a campaign against CleverTap with `estimate_only=true`. Returns estimated reach.      |
| `confirm_draft_campaign` | Create the campaign in CleverTap with `estimate_only=false`. Requires prior user confirmation. |
| `list_draft_campaigns`   | List campaigns created via the API in a date range.                                            |
| `get_draft_campaign`     | Get full details of a specific draft by campaign ID.                                           |
| `update_draft_campaign`  | Update a draft's targeting, content, or schedule. Re-validates with CleverTap.                 |
| `discard_draft_campaign` | Permanently delete a draft.                                                                    |

## Supported Channels

The agent supports the following `target_mode` values: `push`, `email`, `sms`, `webpush`, `whatsapp`, `webhook`. For `email`, `sms`, and `whatsapp`, a `provider_nick_name` is required.

## Workflow Guidelines

The agent enforces a draft-first workflow:

1. Gather required info: name, channel (`target_mode`), content, and audience (`user_property_filters`).
2. Always use `create_draft_campaign` first — never send without creating a draft.
3. Present estimated reach and ask for confirmation.
4. If confirmed, use `confirm_draft_campaign`. If changes needed, use `update_draft_campaign`.
5. If cancelled, use `discard_draft_campaign` to clean up.

## Environment Variables

- `GATEWAY_URL` — AgentCore MCP Gateway URL
- `AGENT_CONFIG_PARAMETER` — SSM parameter name for agent configuration
- `AWS_REGION` — AWS region
