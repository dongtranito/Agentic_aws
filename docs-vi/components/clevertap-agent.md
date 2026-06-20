# CleverTap Agent

CleverTap Agent là một worker agent chịu trách nhiệm quản lý vòng đời chiến dịch trong CleverTap. Nó kết nối tới các tool CleverTap qua AgentCore MCP Gateway và được Marketing Agent gọi đến trong bước tạo chiến dịch.

## Vị trí

[`packages/agents/clevertap/`](../../packages/agents/clevertap/)

## Công nghệ sử dụng

- Python với FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- Factory A2A server dùng chung từ [`packages/agents/common`](../../packages/agents/common/)

## Điểm vào (Entry Point)

[`app/agent/main.py`](../../packages/agents/clevertap/app/agent/main.py)

Dùng factory chung `create_a2a_app()` từ [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) để tạo một ứng dụng FastAPI phục vụ qua giao thức A2A.

## Định nghĩa Agent

[`app/agent/agent.py`](../../packages/agents/clevertap/app/agent/agent.py)

Hàm `get_clevertap_agent()` tạo một Strands Agent với:

- **MCP Gateway client** — kết nối tới `clevertap-target` trên AgentCore Gateway bằng streamable HTTP được xác thực SigV4.
- **Built-in tools** — `current_time` từ `strands_tools`.
- **Cấu hình động** — nạp model ID và system prompt từ SSM Parameter Store.

## Các tool khả dụng

Agent có quyền truy cập sáu tool do CleverTap MCP Server expose:

| Tool                     | Mô tả                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `create_draft_campaign`  | Kiểm định một chiến dịch với CleverTap ở chế độ `estimate_only=true`. Trả về tầm tiếp cận ước tính. |
| `confirm_draft_campaign` | Tạo chiến dịch trong CleverTap với `estimate_only=false`. Yêu cầu người dùng xác nhận trước.     |
| `list_draft_campaigns`   | Liệt kê các chiến dịch được tạo qua API trong một khoảng thời gian.                              |
| `get_draft_campaign`     | Lấy chi tiết đầy đủ của một bản nháp theo campaign ID.                                           |
| `update_draft_campaign`  | Cập nhật targeting, nội dung, hoặc lịch của một bản nháp. Kiểm định lại với CleverTap.           |
| `discard_draft_campaign` | Xóa vĩnh viễn một bản nháp.                                                                      |

## Các kênh được hỗ trợ

Agent hỗ trợ các giá trị `target_mode` sau: `push`, `email`, `sms`, `webpush`, `whatsapp`, `webhook`. Với `email`, `sms` và `whatsapp`, cần có `provider_nick_name`.

## Hướng dẫn quy trình

Agent áp đặt quy trình nháp-trước (draft-first):

1. Thu thập thông tin cần thiết: tên, kênh (`target_mode`), nội dung, và đối tượng (`user_property_filters`).
2. Luôn dùng `create_draft_campaign` trước — không bao giờ gửi mà chưa tạo bản nháp.
3. Trình bày tầm tiếp cận ước tính và yêu cầu xác nhận.
4. Nếu được xác nhận, dùng `confirm_draft_campaign`. Nếu cần thay đổi, dùng `update_draft_campaign`.
5. Nếu bị hủy, dùng `discard_draft_campaign` để dọn dẹp.

## Biến môi trường

- `GATEWAY_URL` — URL của AgentCore MCP Gateway
- `AGENT_CONFIG_PARAMETER` — tên tham số SSM cho cấu hình agent
- `AWS_REGION` — vùng AWS
