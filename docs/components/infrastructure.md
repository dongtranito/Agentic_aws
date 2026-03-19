# Infrastructure

The infrastructure is defined using AWS CDK (TypeScript) and deployed as a single CloudFormation stack. All constructs are located in [`packages/infra/`](../../packages/infra/).

## Application Stack

[`packages/infra/src/stacks/application-stack.ts`](../../packages/infra/src/stacks/application-stack.ts)

The `ApplicationStack` is the top-level stack that orchestrates all resources. It instantiates the following constructs in order:

1. **UserIdentity** — Cognito user pool with an admin user
2. **StorageAndData** — DynamoDB table and S3 buckets
3. **GatewayConstruct** — AgentCore MCP Gateway with three Lambda targets
4. **AgentConstruct** — Four agents (marketer + 3 workers) with shared memory
5. **SeedConfig** — Seeds default agent configuration into SSM Parameter Store
6. **APIConstruct** — Nine Lambda handlers with API Gateway
7. **WebUi** — Static site deployment to S3

## Constructs

### StorageAndData

[`packages/infra/src/constructs/storage-data.ts`](../../packages/infra/src/constructs/storage-data.ts)

Provisions the data layer:

- **Campaigns DynamoDB Table** — partition key `id` (String), PAY_PER_REQUEST billing, AWS-managed encryption, point-in-time recovery enabled. Includes a GSI (`CampaignActiveIndex`) partitioned by `active` and sorted by `createdAt`.
- **Sessions S3 Bucket** — stores conversation artifacts from the Marketing Agent's S3 hook. EventBridge enabled, server access logging to the access logs bucket.
- **SQL Results S3 Bucket** — stores full SQL result sets uploaded by the Databricks MCP Server when results are truncated. CORS enabled for GET requests.
- **Access Logs S3 Bucket** — server access logs for the other buckets.

All buckets enforce SSL, block public access, and disable public read.

### GatewayConstruct

[`packages/infra/src/constructs/gateway.ts`](../../packages/infra/src/constructs/gateway.ts)

Creates the AgentCore MCP Gateway (`marketer-gateway`) with IAM-based authorization and three Lambda targets:

- **DatabricksTarget** ([`gateway/databricks.ts`](../../packages/infra/src/constructs/gateway/databricks.ts)) — Lambda (Node.js 22.x, 60s timeout, 256MB) with Secrets Manager secret for Databricks credentials (URL + PAT). Granted read access to the secret and put access to the SQL results bucket. Registers 8 tools with the gateway.

- **ClevertapTarget** ([`gateway/clevertap.ts`](../../packages/infra/src/constructs/gateway/clevertap.ts)) — Lambda (Node.js 22.x, 30s timeout, 256MB) with Secrets Manager secret for CleverTap credentials (projectId, passcode, region). Registers 6 tools with the gateway.

- **TalonOneTarget** ([`gateway/talonone.ts`](../../packages/infra/src/constructs/gateway/talonone.ts)) — Lambda (Node.js 22.x, 30s timeout, 256MB) with Secrets Manager secret for TalonOne credentials (baseUrl, applicationId, managementKey, integrationKey). Registers 11 tools with the gateway.

Each target defines its tool schemas inline using `agentcore.ToolSchema.fromInline()`.

### AgentConstruct

[`packages/infra/src/constructs/agent.ts`](../../packages/infra/src/constructs/agent.ts)

Deploys all four agents and a shared memory resource:

- **AgentCore Memory** (`marketer_memory`) — short-term conversational memory used by the Marketing Agent.
- **DatabricksAgentConstruct** ([`agents/databricks.ts`](../../packages/infra/src/constructs/agents/databricks.ts)) — deploys the Databricks Agent container with an execution role granting Bedrock model invocation, SSM parameter read, and gateway invocation.
- **ClevertapAgentConstruct** ([`agents/clevertap.ts`](../../packages/infra/src/constructs/agents/clevertap.ts)) — same pattern as Databricks.
- **TalononeAgentConstruct** ([`agents/talonone.ts`](../../packages/infra/src/constructs/agents/talonone.ts)) — same pattern as Databricks.
- **MarketerAgentConstruct** ([`agents/marketer.ts`](../../packages/infra/src/constructs/agents/marketer.ts)) — deploys the Marketing Agent with additional permissions: memory full access, S3 read/write for the sessions bucket, and invoke + GetAgentCard for all three worker agent runtimes.

Each agent construct creates an IAM execution role assumed by `bedrock-agentcore.amazonaws.com` with inline policies for Bedrock model access and SSM parameter read.

### APIConstruct

[`packages/infra/src/constructs/api.ts`](../../packages/infra/src/constructs/api.ts)

Deploys nine Lambda functions and wires them to API Gateway routes with Cognito authorization:

| Handler           | Route                         | Timeout | Key Permissions                                     |
| ----------------- | ----------------------------- | ------- | --------------------------------------------------- |
| getCampaign       | GET /campaign/:id             | 30s     | DynamoDB GetItem                                    |
| getCampaigns      | GET /campaign                 | 30s     | DynamoDB Query (GSI)                                |
| createCampaign    | POST /campaign                | 30s     | DynamoDB PutItem                                    |
| putChat           | PUT /chat                     | 15min   | AgentCore Runtime Invoke                            |
| getChatHistory    | GET /chat/:sessionId          | 30s     | AgentCore Memory ListEvents                         |
| getAgentConfig    | GET /configuration/:agentName | 30s     | SSM GetParameter                                    |
| putAgentConfig    | PUT /configuration/:agentName | 30s     | SSM PutParameter                                    |
| listBedrockModels | GET /configuration/models     | 30s     | Bedrock ListFoundationModels, ListInferenceProfiles |
| getSqlResult      | GET /sql-result/:key+         | 30s     | S3 GetObject                                        |

All handlers use Node.js latest runtime with X-Ray tracing enabled (except putChat which uses response streaming).

### SeedConfig

[`packages/infra/src/constructs/seed-config.ts`](../../packages/infra/src/constructs/seed-config.ts)

Seeds default agent configuration (model ID, system prompt) into SSM Parameter Store during deployment using the values from the deployment config.

### Common Constructs

[`packages/common/constructs/`](../../packages/common/constructs/)

Shared CDK constructs used across the infrastructure:

- **Api** — reusable API Gateway construct with Cognito authorizer, CORS configuration, and WAF integration.
- **WebUi** — static website deployment to S3 with CloudFront distribution.
- **UserIdentity** — Cognito user pool and identity pool setup.
- **MarketerAgent / DatabricksAgent / ClevertapAgent / TalononeAgent** — agent container constructs that handle Docker image building and AgentCore Runtime registration.
- **suppressRules** — utility for suppressing Checkov security rules with documented justifications.

## Deployment Configuration

[`packages/common/types/`](../../packages/common/types/)

Defines TypeScript interfaces for deployment configuration:

- `IDeploymentConfig` — top-level config including admin user, MCP credentials, parameter prefix, and default agent settings.
- `IMcpConfig` — credentials for Databricks, CleverTap, and TalonOne.
- `IRuntimeConfig` — runtime configuration passed to the Web UI (API URL, Cognito props).
