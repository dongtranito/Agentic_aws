# Tiện ích chung cho Agent

Package [`packages/agents/common/`](../../packages/agents/common/) cung cấp các tiện ích Python dùng chung cho cả bốn agent.

## Vị trí

[`packages/agents/common/common/`](../../packages/agents/common/common/)

## Factory A2A Server

[`common/a2a_server.py`](../../packages/agents/common/common/a2a_server.py)

Cung cấp một factory tái sử dụng để tạo các ứng dụng FastAPI phục vụ Strands agent qua giao thức A2A:

- `create_a2a_app(agent_factory)` — nhận một callable trả về một Strands Agent đã cấu hình. Tạo một `A2AServer` của Strands, gắn nó lên một ứng dụng FastAPI, và thêm một endpoint kiểm tra sức khỏe `/ping`. URL runtime được đọc từ biến môi trường `AGENTCORE_RUNTIME_URL` (mặc định `http://127.0.0.1:9000/`).
- `run_a2a_server(agent_factory)` — hàm tiện lợi tạo ứng dụng và chạy nó bằng uvicorn trên `0.0.0.0:9000`.

Được Databricks, CleverTap và TalonOne agent sử dụng. Marketing Agent dùng một triển khai server riêng thay thế.

## Gateway MCP Client

[`common/gateway.py`](../../packages/agents/common/common/gateway.py)

Factory để tạo các MCP client kết nối tới AgentCore Gateway:

- `get_gateway_mcp_client(target_name)` — tạo một `MCPClient` của Strands kết nối tới gateway qua streamable HTTP với xác thực SigV4. Tool được lọc theo một mẫu regex khớp `{target_name}___` để đảm bảo mỗi agent chỉ thấy tool của chính mình.
- `SigV4HTTPXAuth` — lớp auth HTTPX ký các request bằng AWS SigV4 cho dịch vụ `bedrock-agentcore`. Thêm header `x-amz-content-sha256` mà gateway yêu cầu.

Biến môi trường:

- `GATEWAY_URL` — URL của AgentCore MCP Gateway
- `AWS_REGION` — vùng AWS (mặc định `us-east-1`)

## Bộ nạp cấu hình (Configuration Loader)

[`common/config.py`](../../packages/agents/common/common/config.py)

Nạp cấu hình agent từ AWS SSM Parameter Store:

- `load_configuration()` — đọc biến môi trường `AGENT_CONFIG_PARAMETER` để tìm tên tham số SSM, lấy giá trị JSON, và trả về dưới dạng dict. Trả về dict rỗng nếu tham số không được đặt, không tìm thấy, hoặc nạp thất bại. SSM client được khởi tạo lười (lazy) và tái sử dụng.

Dict cấu hình trả về thường chứa:

- `modelId` — Bedrock model ID hoặc inference profile ID
- `systemPrompt` — system prompt tùy chỉnh ghi đè

## SigV4 Auth (Marketing Agent)

[`packages/agents/marketer/app/agent/utils/sigv4_auth.py`](../../packages/agents/marketer/app/agent/utils/sigv4_auth.py)

Một lớp auth HTTPX SigV4 độc lập được A2A client của Marketing Agent dùng để giao tiếp với các runtime của worker agent. Tương tự lớp SigV4 của gateway nhưng không có header content hash, vì nó nhắm tới dịch vụ `bedrock-agentcore` cho việc gọi runtime thay vì gọi tool của gateway.
