# Web UI

Web UI là một ứng dụng single-page React/TypeScript, cung cấp giao diện hướng người dùng để quản lý chiến dịch và tương tác với agent.

## Vị trí

[`packages/web-ui/`](../../packages/web-ui/)

## Công nghệ sử dụng

- React 18 với TypeScript
- TanStack Router (routing dựa trên file)
- [AWS Cloudscape Design System](https://cloudscape.design/) (component + chat component)
- Vite (công cụ build)
- Amazon Cognito (xác thực OIDC)
- Ký request SigV4 qua `aws4fetch`

## Điểm vào (Entry Point)

[`src/main.tsx`](../../packages/web-ui/src/main.tsx)

Ứng dụng được bọc trong cây phân cấp provider sau:

1. **I18nProvider** — quốc tế hóa Cloudscape (tiếng Anh)
2. **RuntimeConfigProvider** — nạp cấu hình runtime (URL API, thuộc tính Cognito) từ một file JSON được triển khai kèm ứng dụng
3. **CognitoAuth** — xác thực OIDC qua `react-oidc-context`
4. **QueryClientProvider** — React Query để lấy dữ liệu
5. **ApiClientProvider** — cung cấp thực thể API client qua React context

## Các route

Routing dựa trên file qua TanStack Router ([`src/routes/`](../../packages/web-ui/src/routes/)):

| Route            | File                                                                        | Mô tả                                   |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `/`              | [`index.tsx`](../../packages/web-ui/src/routes/index.tsx)                   | Chuyển hướng tới danh sách chiến dịch   |
| `/campaign`      | [`campaign.index.tsx`](../../packages/web-ui/src/routes/campaign.index.tsx) | Trang danh sách chiến dịch              |
| `/campaign/:id`  | [`campaign.$id.tsx`](../../packages/web-ui/src/routes/campaign.$id.tsx)     | Trang chi tiết chiến dịch có nhúng chat |
| `/configuration` | [`configuration.tsx`](../../packages/web-ui/src/routes/configuration.tsx)   | Trang cấu hình agent                    |

Layout gốc ([`__root.tsx`](../../packages/web-ui/src/routes/__root.tsx)) bọc tất cả route trong component `AppLayout` của Cloudscape kèm thanh điều hướng bên.

## Các component

### Chat

[`src/components/Chat/`](../../packages/web-ui/src/components/Chat/)

Component tương tác cốt lõi. Render một giao diện chat thời gian thực để trò chuyện với Marketing Agent:

- Nạp lịch sử hội thoại từ API khi mount qua `GET /chat/:sessionId`.
- Gửi tin nhắn qua `PUT /chat` và xử lý luồng SSE thời gian thực.
- Render bốn loại content block: text (hỗ trợ Markdown qua `react-markdown` + `remark-gfm`), tool use (mở rộng được), tool result (mở rộng được), và subagent progress (gắn vào block tool use cha).
- Dùng các component `ChatBubble`, `Avatar`, `LoadingBar` và `PromptInput` của Cloudscape.
- Tự cuộn tới tin nhắn mới nhất.

### CampaignsList

[`src/components/CampaignsList/`](../../packages/web-ui/src/components/CampaignsList/)

Hiển thị một bảng phân trang gồm các chiến dịch với các cột ID, tên, thời gian tạo và thời gian cập nhật. Hỗ trợ kích thước trang tùy chỉnh (5/10/25/50), phân trang tiến/lùi qua token, và một nút làm mới. Bao gồm nút "Create Campaign" mở modal tạo mới.

### CreateCampaignModal

[`src/components/CreateCampaignModal/`](../../packages/web-ui/src/components/CreateCampaignModal/)

Một hộp thoại modal để tạo chiến dịch mới. Nhận tên chiến dịch, gọi `POST /campaign`, và điều hướng tới trang chi tiết của chiến dịch mới khi thành công. Hỗ trợ gửi bằng phím Enter.

### Configuration

[`src/components/Configuration/`](../../packages/web-ui/src/components/Configuration/)

Một trang cấu hình cho phép người dùng chọn một model Bedrock và tùy chỉnh system prompt cho từng agent trong bốn agent (marketer, databricks, clevertap, talonone). Nạp các model khả dụng từ `GET /configuration/models` và cấu hình hiện tại từ `GET /configuration/{agentName}`. Lưu thay đổi qua `PUT /configuration/{agentName}`.

### AppLayout

[`src/components/AppLayout/`](../../packages/web-ui/src/components/AppLayout/)

Lớp bọc `AppLayout` của Cloudscape với một thanh điều hướng bên chứa liên kết tới trang Campaigns và Configuration.

### CognitoAuth

[`src/components/CognitoAuth/`](../../packages/web-ui/src/components/CognitoAuth/)

Lớp bọc xác thực OIDC dùng `react-oidc-context`. Cấu hình Cognito user pool làm nhà cung cấp OIDC và xử lý chuyển hướng đăng nhập.

### RuntimeConfig

[`src/components/RuntimeConfig/`](../../packages/web-ui/src/components/RuntimeConfig/)

Nạp cấu hình runtime từ một file JSON (`/runtime-config.json`) lúc khởi động. Cung cấp cấu hình qua React context. Cấu hình bao gồm URL API Gateway và các thuộc tính Cognito (user pool ID, identity pool ID, region).

## Các hook

### useApi

[`src/hooks/useApi.tsx`](../../packages/web-ui/src/hooks/useApi.tsx)

Cung cấp API client từ context. Client được cấu hình với cơ chế ký request SigV4 và expose các phương thức cho CRUD chiến dịch, chat (streaming), lịch sử chat, cấu hình, và tải kết quả SQL.

### useRuntimeConfig

[`src/hooks/useRuntimeConfig.tsx`](../../packages/web-ui/src/hooks/useRuntimeConfig.tsx)

Đọc cấu hình runtime từ `RuntimeConfigContext`.

### useSigV4

[`src/hooks/useSigV4.tsx`](../../packages/web-ui/src/hooks/useSigV4.tsx)

Trả về một hàm tương thích `fetch` có ký request bằng AWS SigV4, dùng thông tin xác thực tạm thời từ Cognito Identity Pool. Cache thông tin xác thực với khoảng ân hạn hết hạn 30 giây. Dùng `aws4fetch` để ký và `@aws-sdk/credential-provider-cognito-identity` để lấy thông tin xác thực.

## API Client

[`packages/api/src/client/index.ts`](../../packages/api/src/client/index.ts)

Một API client dùng chung được Web UI sử dụng. Dùng `aws4fetch` cho các request được ký SigV4. Cung cấp các phương thức có kiểu cho:

- `campaign.get(id)` — GET /campaign/:id
- `campaign.list({ pageSize, nextToken })` — GET /campaign
- `campaign.create({ name })` — POST /campaign
- `chat.put({ sessionId, prompt }, onChunk)` — PUT /chat (streaming)
- `chat.getHistory(sessionId)` — GET /chat/:sessionId
- `configuration.get(agentName)` — GET /configuration/:agentName
- `configuration.put(agentName, config)` — PUT /configuration/:agentName
- `configuration.listModels()` — GET /configuration/models
- `sqlResult.get(key)` — GET /sql-result/:key
