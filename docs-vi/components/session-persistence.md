# Lưu trữ phiên & Artifact trên S3

Cả bốn agent đều lưu các artifact hội thoại của mình vào cùng một thư mục phiên trên S3, cho phép kiểm toán và soi chiếu toàn bộ quy trình đa-agent từ một vị trí duy nhất.

## Cấu trúc S3

Dựa trên một phiên thực tế (`session-115d83b0-d13a-436b-af69-63e556b601a9`):

```bash
/<sessions-bucket>/
└── session-115d83b0-d13a-436b-af69-63e556b601a9/
    ├── orchestrator/
    │   ├── agent.json
    │   └── messages/
    │       ├── message_0.json
    │       ├── message_1.json
    │       ...
    ├── databricks-agent/
    │   ├── agent.json
    │   └── messages/
    │       ├── message_0.json
    │       ...
    └── clevertap-agent/
        ├── agent.json
        └── messages/
            ├── message_0.json
            ...
```

Trong phiên này, người dùng đã đi qua Bước 1 (định nghĩa đối tượng qua Databricks — 26 tin nhắn gồm các truy vấn SQL và khám phá catalog) và Bước 2 (tạo chiến dịch qua CleverTap — 4 tin nhắn cho việc nháp và xác nhận). TalonOne agent không được gọi vì người dùng bỏ qua bước khuyến mãi tùy chọn.

## Cách Session ID lan truyền

Session ID của orchestrator được truyền tường minh qua toàn bộ chuỗi gọi, để tất cả agent cùng ghi vào một thư mục S3.

### Phía Orchestrator

1. Lambda Put Chat gọi Marketing Agent qua AgentCore Runtime với một `sessionId` (ví dụ `session-28c0fd0c-...`).

2. [`main.py`](../../packages/agents/marketer/app/agent/main.py) nhận session ID từ header `x-amzn-bedrock-agentcore-runtime-session-id` và đặt biến ngữ cảnh `current_session_id` (dùng cho S3 hook của chính orchestrator).

3. [`agent.py`](../../packages/agents/marketer/app/agent/agent.py) truyền `session_id` cho mỗi hàm dựng tool của worker agent:

   ```python
   tools = [
       current_time,
       build_databricks_tool(DATABRICKS_A2A_ENDPOINT, REGION, session_id),
       build_clevertap_tool(CLEVERTAP_A2A_ENDPOINT, REGION, session_id),
       build_talonone_tool(TALONONE_A2A_ENDPOINT, REGION, session_id),
   ]
   ```

4. Mỗi [hàm dựng tool](../../packages/agents/marketer/app/agent/worker_agents/) giữ `session_id` trong closure của nó và truyền cho [`stream_a2a_agent()`](../../packages/agents/marketer/app/agent/utils/a2a.py) trong mỗi lần gọi.

5. `stream_a2a_agent()` truyền nó cho `build_a2a_agent()`, hàm này đặt nó làm header `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` trong request A2A HTTP tới AgentCore Runtime của worker agent.

### Phía Worker Agent

6. Ứng dụng FastAPI của worker agent có một [`SessionIdMiddleware`](../../packages/agents/common/common/a2a_server.py) đọc header `x-amzn-bedrock-agentcore-runtime-session-id` từ request đến và đặt biến ngữ cảnh `current_session_id`.

7. [`S3ArtifactHook`](../../packages/agents/common/common/s3_artifact.py) (được đăng ký lên agent lúc khởi động bởi `create_a2a_app`) đọc `current_session_id` trên mỗi `MessageAddedEvent` và ghi tin nhắn vào `<session_id>/<agent_id>/messages/message_<n>.json`.

## S3 Artifact Hook dùng chung

[`S3ArtifactHook`](../../packages/agents/common/common/s3_artifact.py) trong package `common` được cả bốn agent sử dụng. Nó được tham số hóa bằng một `agent_id` quyết định tên thư mục con:

| Agent            | `agent_id`         | Đường dẫn S3                              |
| ---------------- | ------------------ | ----------------------------------------- |
| Marketing Agent  | `orchestrator`     | `<session_id>/orchestrator/messages/`     |
| Databricks Agent | `databricks-agent` | `<session_id>/databricks-agent/messages/` |
| CleverTap Agent  | `clevertap-agent`  | `<session_id>/clevertap-agent/messages/`  |
| TalonOne Agent   | `talonone-agent`   | `<session_id>/talonone-agent/messages/`   |

Hook xử lý:

- Khởi tạo phiên lười (tạo `agent.json` ở tin nhắn đầu tiên)
- Đánh chỉ mục tin nhắn (đếm số tin nhắn hiện có trên S3 để xác định chỉ mục tiếp theo)
- Tuần tự hóa nội dung (chuyển các object `ContentBlock` của Strands sang JSON)
- Thất bại nhẹ nhàng (ghi cảnh báo nhưng không bao giờ chặn việc thực thi của agent)

## Các quyết định thiết kế then chốt

- Session ID được truyền tường minh qua tham số hàm từ orchestrator tới các worker agent, thay vì dựa vào sự lan truyền của `contextvars` — vốn có thể không tồn tại qua các ranh giới thread/task nội bộ của Strands.
- Orchestrator dùng biến ngữ cảnh `current_session_id` (đặt trong `main.py`) cho S3 hook của chính nó, vì nó chạy trong cùng một ngữ cảnh async.
- Worker agent nhận session ID qua header phiên của AgentCore Runtime, điều này cũng cho phép AgentCore Runtime tái sử dụng cùng một microVM cho nhiều lần gọi tới cùng một worker trong cùng cuộc hội thoại.
- Các artifact trên S3 là chỉ-ghi (write-only). Việc khôi phục phiên do AgentCore Memory đảm nhiệm, không phải bằng cách đọc từ S3.
