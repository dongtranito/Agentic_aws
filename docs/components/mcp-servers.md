# MCP Servers

The prototype provides three custom-built Model Context Protocol (MCP) servers implemented as AWS Lambda functions. They are deployed behind the Amazon Bedrock AgentCore Gateway, which routes tool invocations from agents to the appropriate Lambda target. Each server retrieves third-party credentials from AWS Secrets Manager and calls the respective external API.

## Location

[`packages/api/src/handlers/mcp/`](../../packages/api/src/handlers/mcp/)

## Shared Utilities

[`packages/api/src/handlers/mcp/utils/index.ts`](../../packages/api/src/handlers/mcp/utils/index.ts)

- `extractToolName(fullToolName)` — strips the gateway target prefix from tool names. The gateway uses the format `{target_name}___{tool_name}` (three underscores).
- `getSecret<T>(secretArn)` — fetches and caches a JSON secret from Secrets Manager. Results are cached for the lifetime of the Lambda execution context.
- `GatewayContext` — TypeScript interface for the AgentCore Gateway invocation context, including tool name, message version, request ID, gateway ID, and target ID.

## Databricks MCP Server

[`packages/api/src/handlers/mcp/databricks.ts`](../../packages/api/src/handlers/mcp/databricks.ts)

Implements Databricks API calls via the SQL Statement Execution, SQL Warehouses, Unity Catalog, and Jobs APIs.

**Credentials:** Stored in Secrets Manager as `{ url, token }` (Databricks workspace URL and Personal Access Token).

**Environment variables:**

- `DATABRICKS_SECRET_ARN` — Secrets Manager ARN for Databricks credentials
- `SQL_RESULTS_BUCKET` — S3 bucket for uploading large SQL results

**Tools (8):**

| Tool                   | API                                        | Description                                                        |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `execute_sql`          | POST `/api/2.0/sql/statements`             | Execute a SQL query. Supports optional catalog, schema, row_limit. |
| `get_statement_result` | GET `/api/2.0/sql/statements/{id}`         | Poll for results of a pending/running statement.                   |
| `list_warehouses`      | GET `/api/2.0/sql/warehouses`              | List all available SQL warehouses.                                 |
| `list_schemas`         | GET `/api/2.1/unity-catalog/schemas`       | List schemas in a catalog.                                         |
| `list_tables`          | GET `/api/2.1/unity-catalog/tables`        | List tables in a schema.                                           |
| `get_table`            | GET `/api/2.1/unity-catalog/tables/{name}` | Get table details (columns, types).                                |
| `run_job`              | POST `/api/2.1/jobs/run-now`               | Trigger a Databricks job run.                                      |
| `get_job_run`          | GET `/api/2.1/jobs/runs/get`               | Check job run status.                                              |

**Result truncation:** SQL results exceeding 20 rows or 10KB are truncated. The full result is uploaded to S3 as JSON, and the response includes a `_truncated` object with `total_rows`, `preview_rows`, `full_result_s3_uri`, and `full_result_bytes`.

## CleverTap MCP Server

[`packages/api/src/handlers/mcp/clevertap.ts`](../../packages/api/src/handlers/mcp/clevertap.ts)

Implements CleverTap campaign management via the CleverTap Targets API.

**Credentials:** Stored in Secrets Manager as `{ projectId, passcode, region }`.

**Environment variables:**

- `CLEVERTAP_SECRET_ARN` — Secrets Manager ARN for CleverTap credentials

**Tools (6):**

| Tool                     | API                           | Description                                                                |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------------- |
| `create_draft_campaign`  | POST `/1/targets/create.json` | Create a draft with `estimate_only=true`. Returns estimated reach.         |
| `confirm_draft_campaign` | POST `/1/targets/create.json` | Confirm a draft with `estimate_only=false`. Actually creates the campaign. |
| `list_draft_campaigns`   | POST `/1/targets/list.json`   | List campaigns in a date range (from/to in YYYYMMDD).                      |
| `get_draft_campaign`     | POST `/1/targets/result.json` | Get full details of a draft by campaign ID.                                |
| `update_draft_campaign`  | POST `/1/targets/create.json` | Re-validate a draft with updated parameters (`estimate_only=true`).        |
| `discard_draft_campaign` | POST `/1/targets/stop.json`   | Permanently delete a draft.                                                |

**Audience targeting:** The server translates `user_property_filters` (array of `{ name, operator, value }`) into CleverTap's query language (`common_profile_properties.profile_fields`). Supports optional event-based filters with `event_name`, `from`, and `to` date range.

**Supported channels:** push, email, sms, webpush, whatsapp, webhook.

## TalonOne MCP Server

[`packages/api/src/handlers/mcp/talonone.ts`](../../packages/api/src/handlers/mcp/talonone.ts)

Implements TalonOne campaign, loyalty, and coupon management via both the Management API and Integration API.

**Credentials:** Stored in Secrets Manager as `{ baseUrl, applicationId, managementKey, integrationKey }`.

**Environment variables:**

- `TALONONE_SECRET_ARN` — Secrets Manager ARN for TalonOne credentials

**Tools (11):**

| Tool                      | API Type    | Description                                                         |
| ------------------------- | ----------- | ------------------------------------------------------------------- |
| `list_campaigns`          | Management  | List promotion campaigns with optional state filter and pagination. |
| `get_campaign`            | Management  | Get campaign details by ID.                                         |
| `create_campaign`         | Management  | Create a new campaign (defaults to `disabled` state).               |
| `get_customer_session`    | Management  | Get customer sessions by profile integration ID.                    |
| `update_customer_session` | Integration | Update/create a customer session with cart items and state.         |
| `get_loyalty_program`     | Management  | Get a specific loyalty program or list all.                         |
| `get_customer_loyalty`    | Management  | Get customer loyalty ledger balances.                               |
| `redeem_points`           | Management  | Deduct loyalty points from a customer's balance.                    |
| `list_coupons`            | Management  | List coupons for a campaign.                                        |
| `validate_coupon`         | Management  | Search for a coupon by code across all campaigns.                   |
| `create_coupon`           | Management  | Create a coupon in a campaign with code, discount type, and value.  |

**Authentication:** The Management API uses `ManagementKey-v1` authorization. The Integration API uses `ApiKey-v1` authorization. Both keys are stored in the same Secrets Manager secret.
