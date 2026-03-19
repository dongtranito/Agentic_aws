# API Handlers

The API layer consists of nine AWS Lambda functions exposed via Amazon API Gateway with Cognito-based authorization. Each handler is individually bundled and deployed as a separate Lambda function. The handlers are written in TypeScript and organized under [`packages/api/src/handlers/api/`](../../packages/api/src/handlers/api/).

## Endpoints

### Campaign Management

**GET /campaign** — [`getCampaigns.ts`](../../packages/api/src/handlers/api/getCampaigns.ts)

Lists active campaigns from the DynamoDB Campaigns table. Queries the `CampaignActiveIndex` Global Secondary Index (partitioned by `active`, sorted by `createdAt`) to return campaigns in reverse chronological order. Supports pagination via `pageSize` and `nextToken` query parameters.

Environment variables:

- `CAMPAIGNS_TABLE_NAME` — DynamoDB table name
- `CAMPAIGN_ACTIVE_INDEX` — GSI index name

**GET /campaign/:id** — [`getCampaign.ts`](../../packages/api/src/handlers/api/getCampaign.ts)

Retrieves a single campaign by its partition key (`id`) from the DynamoDB Campaigns table.

Environment variables:

- `CAMPAIGNS_TABLE_NAME` — DynamoDB table name

**POST /campaign** — [`createCampaign.ts`](../../packages/api/src/handlers/api/createCampaign.ts)

Creates a new campaign record. Generates a UUID, sets `active: "Y"` and timestamps, then writes to DynamoDB. Requires a `name` field in the request body; `description` is optional.

Environment variables:

- `CAMPAIGNS_TABLE_NAME` — DynamoDB table name

### Chat

**PUT /chat** — [`putChat.ts`](../../packages/api/src/handlers/api/putChat.ts)

The streaming chat handler. Accepts a `prompt` and `sessionId` in the request body, extracts the Cognito user ID (`sub`) from the JWT token, and invokes the Marketing Agent through the Bedrock AgentCore Runtime using `InvokeAgentRuntimeCommand`. The response is streamed back to the client as Server-Sent Events (SSE) using Lambda response streaming (`awslambda.streamifyResponse`). This handler has a 15-minute timeout to accommodate long-running agent conversations.

Environment variables:

- `AGENT_RUNTIME_ARN` — ARN of the Marketing Agent's AgentCore Runtime

**GET /chat/:sessionId** — [`getChatHistory.ts`](../../packages/api/src/handlers/api/getChatHistory.ts)

Retrieves conversation history from AgentCore Memory using `ListEventsCommand`. Parses the conversational payload events, extracts text, tool use, and tool result blocks, strips gateway prefixes from tool names (e.g. `target___toolname` → `toolname`), and consolidates consecutive same-role messages. Tool result messages are merged into the preceding assistant message for a coherent UI display.

Environment variables:

- `MEMORY_ID` — AgentCore Memory resource ID

### Configuration

**GET /configuration/{agentName}** — [`getAgentConfig.ts`](../../packages/api/src/handlers/api/getAgentConfig.ts)

Reads the configuration (model ID, system prompt) for a specific agent from AWS Systems Manager Parameter Store. Valid agent names are: `marketer`, `databricks`, `talonone`, `clevertap` (validated via Zod schema). Returns a default empty config if the parameter doesn't exist.

Environment variables:

- `PARAMETER_PREFIX` — SSM parameter path prefix

**PUT /configuration/{agentName}** — [`putAgentConfig.ts`](../../packages/api/src/handlers/api/putAgentConfig.ts)

Writes updated configuration for a specific agent to Parameter Store. Validates the request body against `PutAgentConfigInputSchema` (Zod). Overwrites the existing parameter value.

Environment variables:

- `PARAMETER_PREFIX` — SSM parameter path prefix

**GET /configuration/models** — [`listBedrockModels.ts`](../../packages/api/src/handlers/api/listBedrockModels.ts)

Lists available Bedrock models by combining foundation models (on-demand) and inference profiles (regional + cross-region). Filters for active models only. Used by the Web UI to populate the model selector dropdown in the configuration page.

### Utilities

**GET /sql-result/{key+}** — [`getSqlResult.ts`](../../packages/api/src/handlers/api/getSqlResult.ts)

Generates a presigned S3 URL (1-hour expiry) for downloading full SQL result sets. When the Databricks MCP Server truncates large query results, it uploads the full dataset to S3 and returns a key reference. The Web UI calls this endpoint to get a downloadable link.

Environment variables:

- `SQL_RESULTS_BUCKET` — S3 bucket name for SQL results

## Shared Utilities

Located in [`packages/api/src/handlers/api/utils/`](../../packages/api/src/handlers/api/utils/):

- CORS headers configuration
- DynamoDB Document Client instance

## Schemas

Located in [`packages/api/src/schema/`](../../packages/api/src/schema/):

- [`campaign.ts`](../../packages/api/src/schema/campaign.ts) — Campaign input/output schemas (Zod)
- [`chat.ts`](../../packages/api/src/schema/chat.ts) — Chat message, content block, and history schemas (Zod)
- [`configuration.ts`](../../packages/api/src/schema/configuration.ts) — Agent name enum, agent config, and model list schemas (Zod)
