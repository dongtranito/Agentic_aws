# API Handlers

Tầng API gồm chín hàm AWS Lambda được expose qua Amazon API Gateway với cơ chế phân quyền dựa trên Cognito. Mỗi handler được bundle và triển khai riêng thành một hàm Lambda độc lập. Các handler được viết bằng TypeScript và tổ chức trong [`packages/api/src/handlers/api/`](../../packages/api/src/handlers/api/).

## Các endpoint

### Quản lý chiến dịch

**GET /campaign** — [`getCampaigns.ts`](../../packages/api/src/handlers/api/getCampaigns.ts)

Liệt kê các chiến dịch đang hoạt động từ bảng DynamoDB Campaigns. Truy vấn Global Secondary Index `CampaignActiveIndex` (phân vùng theo `active`, sắp xếp theo `createdAt`) để trả về các chiến dịch theo thứ tự thời gian ngược. Hỗ trợ phân trang qua tham số truy vấn `pageSize` và `nextToken`.

Biến môi trường:

- `CAMPAIGNS_TABLE_NAME` — tên bảng DynamoDB
- `CAMPAIGN_ACTIVE_INDEX` — tên index GSI

**GET /campaign/:id** — [`getCampaign.ts`](../../packages/api/src/handlers/api/getCampaign.ts)

Lấy một chiến dịch theo partition key (`id`) từ bảng DynamoDB Campaigns.

Biến môi trường:

- `CAMPAIGNS_TABLE_NAME` — tên bảng DynamoDB

**POST /campaign** — [`createCampaign.ts`](../../packages/api/src/handlers/api/createCampaign.ts)

Tạo một bản ghi chiến dịch mới. Sinh một UUID, đặt `active: "Y"` cùng các mốc thời gian, rồi ghi vào DynamoDB. Yêu cầu trường `name` trong body request; `description` là tùy chọn.

Biến môi trường:

- `CAMPAIGNS_TABLE_NAME` — tên bảng DynamoDB

### Chat

**PUT /chat** — [`putChat.ts`](../../packages/api/src/handlers/api/putChat.ts)

Handler chat dạng streaming. Nhận `prompt` và `sessionId` trong body request, trích xuất Cognito user ID (`sub`) từ JWT token, và gọi Marketing Agent qua Bedrock AgentCore Runtime bằng `InvokeAgentRuntimeCommand`. Phản hồi được stream ngược về client dưới dạng Server-Sent Events (SSE) bằng cơ chế Lambda response streaming (`awslambda.streamifyResponse`). Handler này có timeout 15 phút để phục vụ các cuộc hội thoại agent kéo dài.

Biến môi trường:

- `AGENT_RUNTIME_ARN` — ARN của AgentCore Runtime của Marketing Agent

**GET /chat/:sessionId** — [`getChatHistory.ts`](../../packages/api/src/handlers/api/getChatHistory.ts)

Lấy lịch sử hội thoại từ AgentCore Memory bằng `ListEventsCommand`. Phân tích các sự kiện payload hội thoại, trích xuất các block text, tool use và tool result, lược bỏ tiền tố gateway khỏi tên tool (ví dụ `target___toolname` → `toolname`), và gộp các tin nhắn cùng vai trò liên tiếp. Các tin nhắn tool result được gộp vào tin nhắn assistant liền trước để hiển thị mạch lạc trên UI.

Biến môi trường:

- `MEMORY_ID` — ID tài nguyên AgentCore Memory

### Cấu hình

**GET /configuration/{agentName}** — [`getAgentConfig.ts`](../../packages/api/src/handlers/api/getAgentConfig.ts)

Đọc cấu hình (model ID, system prompt) cho một agent cụ thể từ AWS Systems Manager Parameter Store. Tên agent hợp lệ gồm: `marketer`, `databricks`, `talonone`, `clevertap` (được kiểm định qua Zod schema). Trả về cấu hình rỗng mặc định nếu tham số không tồn tại.

Biến môi trường:

- `PARAMETER_PREFIX` — tiền tố đường dẫn tham số SSM

**PUT /configuration/{agentName}** — [`putAgentConfig.ts`](../../packages/api/src/handlers/api/putAgentConfig.ts)

Ghi cấu hình cập nhật cho một agent cụ thể vào Parameter Store. Kiểm định body request theo `PutAgentConfigInputSchema` (Zod). Ghi đè giá trị tham số hiện có.

Biến môi trường:

- `PARAMETER_PREFIX` — tiền tố đường dẫn tham số SSM

**GET /configuration/models** — [`listBedrockModels.ts`](../../packages/api/src/handlers/api/listBedrockModels.ts)

Liệt kê các model Bedrock khả dụng bằng cách kết hợp các foundation model (on-demand) và inference profile (regional + cross-region). Chỉ lọc các model đang hoạt động. Web UI dùng endpoint này để đổ dữ liệu cho dropdown chọn model ở trang cấu hình.

### Tiện ích

**GET /sql-result/{key+}** — [`getSqlResult.ts`](../../packages/api/src/handlers/api/getSqlResult.ts)

Sinh một URL S3 presigned (hết hạn sau 1 giờ) để tải toàn bộ tập kết quả SQL. Khi Databricks MCP Server cắt bớt kết quả truy vấn lớn, nó tải toàn bộ dataset lên S3 và trả về một key tham chiếu. Web UI gọi endpoint này để lấy liên kết tải về.

Biến môi trường:

- `SQL_RESULTS_BUCKET` — tên S3 bucket cho kết quả SQL

## Tiện ích dùng chung

Nằm ở [`packages/api/src/handlers/api/utils/`](../../packages/api/src/handlers/api/utils/):

- Cấu hình header CORS
- Thực thể DynamoDB Document Client

## Schema

Nằm ở [`packages/api/src/schema/`](../../packages/api/src/schema/):

- [`campaign.ts`](../../packages/api/src/schema/campaign.ts) — schema input/output của Campaign (Zod)
- [`chat.ts`](../../packages/api/src/schema/chat.ts) — schema tin nhắn chat, content block và lịch sử (Zod)
- [`configuration.ts`](../../packages/api/src/schema/configuration.ts) — enum tên agent, cấu hình agent và schema danh sách model (Zod)
