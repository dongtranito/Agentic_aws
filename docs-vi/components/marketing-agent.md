# Marketing Agent

Marketing Agent là agent điều phối trung tâm của nền tảng. Nó dẫn dắt người dùng qua một quy trình tạo chiến dịch có cấu trúc gồm ba bước, bằng cách ủy thác các tác vụ cho ba worker agent chuyên biệt thông qua giao tiếp Agent-to-Agent (A2A).

## Vị trí

[`packages/agents/marketer/`](../../packages/agents/marketer/)

## Công nghệ sử dụng

- Python với FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- AgentCore Memory để lưu trữ phiên

## Điểm vào (Entry Point)

[`app/agent/main.py`](../../packages/agents/marketer/app/agent/main.py)

Marketing Agent được phục vụ theo cách khác với các worker agent. Thay vì dùng factory chung `create_a2a_app`, nó định nghĩa một ứng dụng FastAPI riêng với endpoint `/invocations` (bắt buộc bởi AgentCore Runtime) và một endpoint kiểm tra sức khỏe `/ping`. Endpoint `/invocations` phân tích payload đến, trích xuất prompt và actor ID, rồi trả về một `StreamingResponse` với các sự kiện định dạng SSE.

## Định nghĩa Agent

[`app/agent/agent.py`](../../packages/agents/marketer/app/agent/agent.py)

Hàm `get_agent()` là một context manager tạo ra một Strands Agent được cấu hình đầy đủ với:

- **AgentCore Memory** — cấu hình qua `AgentCoreMemoryConfig` và `AgentCoreMemorySessionManager` để lưu trữ phiên xuyên suốt các cuộc hội thoại.
- **Worker agent tools** — ba tool A2A bao bọc (`databricks_agent`, `clevertap_agent`, `talonone_agent`) được dựng từ ARN của AgentCore Runtime tương ứng.
- **Built-in tools** — `current_time` từ `strands_tools`.
- **S3 Artifact Hook** — đăng ký một hook lưu mọi tin nhắn hội thoại lên S3 để lưu trữ và kiểm toán.
- **Cấu hình động** — nạp model ID và system prompt từ SSM Parameter Store tại thời điểm gọi.

## Quy trình

System prompt của agent áp đặt một quy trình ba bước nghiêm ngặt:

1. **Định nghĩa đối tượng mục tiêu** — Dùng `databricks_agent` để khám phá các tag, thuộc tính người dùng, và chạy truy vấn SQL để ước lượng quy mô đối tượng. Yêu cầu người dùng xác nhận rõ ràng trước khi tiếp tục.
2. **Tạo chiến dịch trong CleverTap** — Dùng `clevertap_agent` để tạo một chiến dịch nháp với targeting đối tượng đã xác nhận, trình bày tầm tiếp cận ước tính, và hoàn tất khi người dùng xác nhận.
3. **Tạo khuyến mãi trong TalonOne (tùy chọn)** — Dùng `talonone_agent` để thiết lập chiến dịch khuyến mãi nếu người dùng chọn tham gia.

Agent từ chối hỗ trợ bất cứ điều gì nằm ngoài quy trình này.

## Worker Agent Tools

Nằm ở [`app/agent/worker_agents/`](../../packages/agents/marketer/app/agent/worker_agents/):

Mỗi worker agent tool được dựng bằng các hàm factory `build_*_tool()`. Chúng tạo ra các async generator được trang trí bằng `@tool` của Strands, ủy thác cho các agent từ xa qua A2A streaming:

- [`build_databricks_tool()`](../../packages/agents/marketer/app/agent/worker_agents/databricks.py) — bao bọc Databricks Agent
- [`build_clevertap_tool()`](../../packages/agents/marketer/app/agent/worker_agents/clevertap.py) — bao bọc CleverTap Agent
- [`build_talonone_tool()`](../../packages/agents/marketer/app/agent/worker_agents/talonone.py) — bao bọc TalonOne Agent

Mỗi tool nhận một chuỗi `request` bằng ngôn ngữ tự nhiên và phát ra các sự kiện `SubAgentProgress` khi agent từ xa stream phản hồi.

## Giao tiếp A2A

Nằm ở [`app/agent/utils/a2a.py`](../../packages/agents/marketer/app/agent/utils/a2a.py):

Module tiện ích A2A xử lý giao tiếp với các worker agent được triển khai trên AgentCore Runtime:

- `build_a2a_agent()` — dựng một `A2AAgent` của Strands với HTTPX client được xác thực SigV4, lấy agent card qua boto3, và dựng URL endpoint từ ARN của agent.
- `stream_a2a_agent()` — async generator stream tiến trình từ một agent từ xa, phát ra các sự kiện `SubAgentProgress` cho các cập nhật trung gian và chuỗi phản hồi cuối cùng làm phần tử cuối.

## S3 Artifact Hook

Nằm ở [`app/agent/hooks/s3_artifact.py`](../../packages/agents/marketer/app/agent/hooks/s3_artifact.py):

`S3ArtifactHook` lưu các tin nhắn hội thoại lên S3 theo cấu trúc thư mục của `FileSessionManager` (Strands):

```
/<bucket>/<session_id>/agents/agent_marketer/messages/message_0.json
```

Nó đăng ký một callback `MessageAddedEvent` với registry hook của agent. Đây là cơ chế chỉ-ghi — việc khôi phục phiên do AgentCore Memory đảm nhiệm.

## Định dạng sự kiện SSE

Bộ xử lý streaming phát ra bốn loại sự kiện SSE:

- `{"type": "text", "content": "..."}` — các đoạn văn bản từ agent
- `{"type": "tool_use", "name": "...", "input": {...}}` — khi một lời gọi tool bắt đầu
- `{"type": "tool_result", "name": "...", "status": "...", "output": "..."}` — khi một tool hoàn tất
- `{"type": "subagent_progress", "agent": "...", "content": "..."}` — stream trung gian từ các worker agent

## Biến môi trường

- `MEMORY_ID` — ID tài nguyên AgentCore Memory
- `AWS_REGION` — vùng AWS
- `DATABRICKS_A2A_ENDPOINT` — ARN Runtime của Databricks Agent
- `CLEVERTAP_A2A_ENDPOINT` — ARN Runtime của CleverTap Agent
- `TALONONE_A2A_ENDPOINT` — ARN Runtime của TalonOne Agent
- `GATEWAY_URL` — URL của AgentCore MCP Gateway
- `ARTIFACT_BUCKET` — S3 bucket cho các artifact hội thoại
- `AGENT_CONFIG_PARAMETER` — tên tham số SSM cho cấu hình agent
