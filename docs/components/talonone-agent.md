# TalonOne Agent

The TalonOne Agent is a worker agent focused on loyalty and promotions management through TalonOne's Management and Integration APIs. It is invoked by the Marketing Agent during the optional third step of the workflow.

## Location

[`packages/agents/talonone/`](../../packages/agents/talonone/)

## Technology Stack

- Python with FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- Shared A2A server factory from [`packages/agents/common`](../../packages/agents/common/)

## Entry Point

[`app/agent/main.py`](../../packages/agents/talonone/app/agent/main.py)

Uses the shared `create_a2a_app()` factory from [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) to create a FastAPI application served over the A2A protocol.

## Agent Definition

[`app/agent/agent.py`](../../packages/agents/talonone/app/agent/agent.py)

The `get_talonone_agent()` function creates a Strands Agent with:

- **MCP Gateway client** — connects to the `talonone-target` on the AgentCore Gateway using SigV4-authenticated streamable HTTP.
- **Built-in tools** — `current_time` from `strands_tools`.
- **Dynamic configuration** — loads model ID and system prompt from SSM Parameter Store.

## Available Tools

The agent has access to eleven tools exposed by the TalonOne MCP Server:

| Tool                      | Description                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| `list_campaigns`          | List promotion campaigns. Optional filters: state, page_size, skip.              |
| `get_campaign`            | Get details of a campaign by campaign_id.                                        |
| `create_campaign`         | Create a new promotion campaign. Requires name.                                  |
| `get_customer_session`    | Get customer shopping sessions by customer_id.                                   |
| `update_customer_session` | Update/create a session. Accepts customer_id, cart_items, state.                 |
| `get_loyalty_program`     | Get loyalty program details or list all programs.                                |
| `get_customer_loyalty`    | Get customer loyalty balances. Requires customer_id and program_id.              |
| `redeem_points`           | Deduct loyalty points. Requires customer_id, program_id, and points.             |
| `list_coupons`            | List coupons for a campaign. Requires campaign_id.                               |
| `validate_coupon`         | Search for a coupon by coupon_code across all campaigns.                         |
| `create_coupon`           | Create a coupon in a campaign. Requires campaign_id, code, discount_type, value. |

## Workflow Guidelines

1. Use `list_campaigns` to discover available campaigns before other operations.
2. Use `get_customer_session` before making updates.
3. Check loyalty status with `get_customer_loyalty` before redeeming points.
4. Validate coupons with `validate_coupon` before applying them.
5. When creating coupons, find a campaign_id via `list_campaigns` first.
6. New campaigns are created with `state: "disabled"` by default for review before activation.

## Environment Variables

- `GATEWAY_URL` — AgentCore MCP Gateway URL
- `AGENT_CONFIG_PARAMETER` — SSM parameter name for agent configuration
- `AWS_REGION` — AWS region
