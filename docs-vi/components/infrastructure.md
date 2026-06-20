# Hạ tầng

Hạ tầng được định nghĩa bằng AWS CDK (TypeScript) và triển khai dưới dạng một stack CloudFormation duy nhất. Tất cả các construct nằm ở [`packages/infra/`](../../packages/infra/).

## Application Stack

[`packages/infra/src/stacks/application-stack.ts`](../../packages/infra/src/stacks/application-stack.ts)

`ApplicationStack` là stack cấp cao nhất điều phối toàn bộ tài nguyên. Nó khởi tạo các construct sau theo thứ tự:

1. **UserIdentity** — Cognito user pool kèm một admin user
2. **StorageAndData** — bảng DynamoDB và các S3 bucket
3. **GatewayConstruct** — AgentCore MCP Gateway với ba Lambda target
4. **AgentConstruct** — Bốn agent (marketer + 3 worker) với bộ nhớ dùng chung
5. **SeedConfig** — Nạp cấu hình agent mặc định vào SSM Parameter Store
6. **APIConstruct** — Chín Lambda handler với API Gateway
7. **WebUi** — Triển khai static site lên S3

## Các construct

### StorageAndData

[`packages/infra/src/constructs/storage-data.ts`](../../packages/infra/src/constructs/storage-data.ts)

Cấp phát tầng dữ liệu:

- **Bảng DynamoDB Campaigns** — partition key `id` (String), billing PAY_PER_REQUEST, mã hóa do AWS quản lý, bật point-in-time recovery. Bao gồm một GSI (`CampaignActiveIndex`) phân vùng theo `active` và sắp xếp theo `createdAt`.
- **S3 Bucket Sessions** — lưu các artifact hội thoại từ S3 hook của Marketing Agent. Bật EventBridge, ghi log truy cập server vào access logs bucket.
- **S3 Bucket SQL Results** — lưu toàn bộ tập kết quả SQL do Databricks MCP Server tải lên khi kết quả bị cắt bớt. Bật CORS cho request GET.
- **S3 Bucket Access Logs** — log truy cập server cho các bucket khác.

Tất cả bucket đều bắt buộc SSL, chặn truy cập public và tắt quyền đọc public.

### GatewayConstruct

[`packages/infra/src/constructs/gateway.ts`](../../packages/infra/src/constructs/gateway.ts)

Tạo AgentCore MCP Gateway (`marketer-gateway`) với phân quyền dựa trên IAM và ba Lambda target:

- **DatabricksTarget** ([`gateway/databricks.ts`](../../packages/infra/src/constructs/gateway/databricks.ts)) — Lambda (Node.js 22.x, timeout 60s, 256MB) với secret Secrets Manager cho thông tin xác thực Databricks (URL + PAT). Được cấp quyền đọc secret và quyền put vào SQL results bucket. Đăng ký 8 tool với gateway.

- **ClevertapTarget** ([`gateway/clevertap.ts`](../../packages/infra/src/constructs/gateway/clevertap.ts)) — Lambda (Node.js 22.x, timeout 30s, 256MB) với secret Secrets Manager cho thông tin xác thực CleverTap (projectId, passcode, region). Đăng ký 6 tool với gateway.

- **TalonOneTarget** ([`gateway/talonone.ts`](../../packages/infra/src/constructs/gateway/talonone.ts)) — Lambda (Node.js 22.x, timeout 30s, 256MB) với secret Secrets Manager cho thông tin xác thực TalonOne (baseUrl, applicationId, managementKey, integrationKey). Đăng ký 11 tool với gateway.

Mỗi target định nghĩa schema tool của mình inline bằng `agentcore.ToolSchema.fromInline()`.

### AgentConstruct

[`packages/infra/src/constructs/agent.ts`](../../packages/infra/src/constructs/agent.ts)

Triển khai cả bốn agent và một tài nguyên bộ nhớ dùng chung:

- **AgentCore Memory** (`marketer_memory`) — bộ nhớ hội thoại ngắn hạn được Marketing Agent sử dụng.
- **DatabricksAgentConstruct** ([`agents/databricks.ts`](../../packages/infra/src/constructs/agents/databricks.ts)) — triển khai container Databricks Agent với một execution role cấp quyền gọi model Bedrock, đọc tham số SSM và gọi gateway.
- **ClevertapAgentConstruct** ([`agents/clevertap.ts`](../../packages/infra/src/constructs/agents/clevertap.ts)) — cùng mẫu với Databricks.
- **TalononeAgentConstruct** ([`agents/talonone.ts`](../../packages/infra/src/constructs/agents/talonone.ts)) — cùng mẫu với Databricks.
- **MarketerAgentConstruct** ([`agents/marketer.ts`](../../packages/infra/src/constructs/agents/marketer.ts)) — triển khai Marketing Agent với các quyền bổ sung: toàn quyền với memory, đọc/ghi S3 cho sessions bucket, và quyền invoke + GetAgentCard cho cả ba runtime của worker agent.

Mỗi agent construct tạo một IAM execution role được `bedrock-agentcore.amazonaws.com` đảm nhận (assume), kèm các inline policy cho quyền truy cập model Bedrock và đọc tham số SSM.

### APIConstruct

[`packages/infra/src/constructs/api.ts`](../../packages/infra/src/constructs/api.ts)

Triển khai chín hàm Lambda và đấu nối chúng với các route API Gateway có phân quyền Cognito:

| Handler           | Route                         | Timeout | Quyền chính                                         |
| ----------------- | ----------------------------- | ------- | --------------------------------------------------- |
| getCampaign       | GET /campaign/:id             | 30s     | DynamoDB GetItem                                    |
| getCampaigns      | GET /campaign                 | 30s     | DynamoDB Query (GSI)                                |
| createCampaign    | POST /campaign                | 30s     | DynamoDB PutItem                                    |
| putChat           | PUT /chat                     | 15 phút | AgentCore Runtime Invoke                            |
| getChatHistory    | GET /chat/:sessionId          | 30s     | AgentCore Memory ListEvents                         |
| getAgentConfig    | GET /configuration/:agentName | 30s     | SSM GetParameter                                    |
| putAgentConfig    | PUT /configuration/:agentName | 30s     | SSM PutParameter                                    |
| listBedrockModels | GET /configuration/models     | 30s     | Bedrock ListFoundationModels, ListInferenceProfiles |
| getSqlResult      | GET /sql-result/:key+         | 30s     | S3 GetObject                                        |

Tất cả handler dùng runtime Node.js mới nhất với X-Ray tracing được bật (trừ putChat dùng response streaming).

### SeedConfig

[`packages/infra/src/constructs/seed-config.ts`](../../packages/infra/src/constructs/seed-config.ts)

Nạp cấu hình agent mặc định (model ID, system prompt) vào SSM Parameter Store trong quá trình triển khai, dùng các giá trị từ cấu hình triển khai.

### Common Constructs

[`packages/common/constructs/`](../../packages/common/constructs/)

Các CDK construct dùng chung xuyên suốt hạ tầng:

- **Api** — construct API Gateway tái sử dụng với Cognito authorizer, cấu hình CORS và tích hợp WAF.
- **WebUi** — triển khai website tĩnh lên S3 với phân phối CloudFront.
- **UserIdentity** — thiết lập Cognito user pool và identity pool.
- **MarketerAgent / DatabricksAgent / ClevertapAgent / TalononeAgent** — các construct container của agent, xử lý việc build Docker image và đăng ký với AgentCore Runtime.
- **suppressRules** — tiện ích để tắt các quy tắc bảo mật Checkov kèm lý do được ghi chú.

## Cấu hình triển khai

[`packages/common/types/`](../../packages/common/types/)

Định nghĩa các interface TypeScript cho cấu hình triển khai:

- `IDeploymentConfig` — cấu hình cấp cao nhất gồm admin user, thông tin xác thực MCP, tiền tố tham số, và thiết lập agent mặc định.
- `IMcpConfig` — thông tin xác thực cho Databricks, CleverTap và TalonOne.
- `IRuntimeConfig` — cấu hình runtime truyền tới Web UI (URL API, thuộc tính Cognito).
