# Web UI

The Web UI is a React/TypeScript single-page application that provides the user-facing interface for campaign management and agent interaction.

## Location

[`packages/web-ui/`](../../packages/web-ui/)

## Technology Stack

- React 18 with TypeScript
- TanStack Router (file-based routing)
- [AWS Cloudscape Design System](https://cloudscape.design/) (components + chat components)
- Vite (build tooling)
- Amazon Cognito (OIDC authentication)
- SigV4 request signing via `aws4fetch`

## Entry Point

[`src/main.tsx`](../../packages/web-ui/src/main.tsx)

The application is wrapped in the following provider hierarchy:

1. **I18nProvider** — Cloudscape internationalization (English)
2. **RuntimeConfigProvider** — loads runtime configuration (API URL, Cognito props) from a JSON file deployed alongside the app
3. **CognitoAuth** — OIDC authentication via `react-oidc-context`
4. **QueryClientProvider** — React Query for data fetching
5. **ApiClientProvider** — provides the API client instance via React context

## Routes

File-based routing via TanStack Router ([`src/routes/`](../../packages/web-ui/src/routes/)):

| Route            | File                                                                        | Description                             |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `/`              | [`index.tsx`](../../packages/web-ui/src/routes/index.tsx)                   | Redirects to campaign list              |
| `/campaign`      | [`campaign.index.tsx`](../../packages/web-ui/src/routes/campaign.index.tsx) | Campaign list page                      |
| `/campaign/:id`  | [`campaign.$id.tsx`](../../packages/web-ui/src/routes/campaign.$id.tsx)     | Campaign detail page with embedded chat |
| `/configuration` | [`configuration.tsx`](../../packages/web-ui/src/routes/configuration.tsx)   | Agent configuration page                |

The root layout ([`__root.tsx`](../../packages/web-ui/src/routes/__root.tsx)) wraps all routes in the Cloudscape `AppLayout` component with navigation sidebar.

## Components

### Chat

[`src/components/Chat/`](../../packages/web-ui/src/components/Chat/)

The core interactive component. Renders a real-time chat interface for conversing with the Marketing Agent:

- Loads conversation history from the API on mount via `GET /chat/:sessionId`.
- Sends messages via `PUT /chat` and processes the SSE stream in real-time.
- Renders four types of content blocks: text (with Markdown support via `react-markdown` + `remark-gfm`), tool use (expandable), tool result (expandable), and subagent progress (attached to the parent tool use block).
- Uses Cloudscape `ChatBubble`, `Avatar`, `LoadingBar`, and `PromptInput` components.
- Auto-scrolls to the latest message.

### CampaignsList

[`src/components/CampaignsList/`](../../packages/web-ui/src/components/CampaignsList/)

Displays a paginated table of campaigns with columns for ID, name, created at, and updated at. Supports configurable page size (5/10/25/50), forward/backward pagination via tokens, and a refresh button. Includes a "Create Campaign" button that opens the create modal.

### CreateCampaignModal

[`src/components/CreateCampaignModal/`](../../packages/web-ui/src/components/CreateCampaignModal/)

A modal dialog for creating a new campaign. Accepts a campaign name, calls `POST /campaign`, and navigates to the new campaign's detail page on success. Supports Enter key submission.

### Configuration

[`src/components/Configuration/`](../../packages/web-ui/src/components/Configuration/)

A configuration page that allows users to select a Bedrock model and customize the system prompt for each of the four agents (marketer, databricks, clevertap, talonone). Loads available models from `GET /configuration/models` and current config from `GET /configuration/{agentName}`. Saves changes via `PUT /configuration/{agentName}`.

### AppLayout

[`src/components/AppLayout/`](../../packages/web-ui/src/components/AppLayout/)

Cloudscape `AppLayout` wrapper with a navigation sidebar containing links to Campaigns and Configuration pages.

### CognitoAuth

[`src/components/CognitoAuth/`](../../packages/web-ui/src/components/CognitoAuth/)

OIDC authentication wrapper using `react-oidc-context`. Configures the Cognito user pool as the OIDC provider and handles login redirects.

### RuntimeConfig

[`src/components/RuntimeConfig/`](../../packages/web-ui/src/components/RuntimeConfig/)

Loads runtime configuration from a JSON file (`/runtime-config.json`) at startup. Provides the config via React context. The config includes the API Gateway URL and Cognito properties (user pool ID, identity pool ID, region).

## Hooks

### useApi

[`src/hooks/useApi.tsx`](../../packages/web-ui/src/hooks/useApi.tsx)

Provides the API client from context. The client is configured with SigV4 request signing and exposes methods for campaign CRUD, chat (streaming), chat history, configuration, and SQL result download.

### useRuntimeConfig

[`src/hooks/useRuntimeConfig.tsx`](../../packages/web-ui/src/hooks/useRuntimeConfig.tsx)

Reads the runtime configuration from the `RuntimeConfigContext`.

### useSigV4

[`src/hooks/useSigV4.tsx`](../../packages/web-ui/src/hooks/useSigV4.tsx)

Returns a `fetch`-compatible function that signs requests with AWS SigV4 using temporary credentials from Cognito Identity Pool. Caches credentials with a 30-second expiry grace period. Uses `aws4fetch` for signing and `@aws-sdk/credential-provider-cognito-identity` for credential retrieval.

## API Client

[`packages/api/src/client/index.ts`](../../packages/api/src/client/index.ts)

A shared API client used by the Web UI. Uses `aws4fetch` for SigV4-signed requests. Provides typed methods for:

- `campaign.get(id)` — GET /campaign/:id
- `campaign.list({ pageSize, nextToken })` — GET /campaign
- `campaign.create({ name })` — POST /campaign
- `chat.put({ sessionId, prompt }, onChunk)` — PUT /chat (streaming)
- `chat.getHistory(sessionId)` — GET /chat/:sessionId
- `configuration.get(agentName)` — GET /configuration/:agentName
- `configuration.put(agentName, config)` — PUT /configuration/:agentName
- `configuration.listModels()` — GET /configuration/models
- `sqlResult.get(key)` — GET /sql-result/:key
