# TalonOne Agent

TalonOne Agent là một worker agent tập trung vào quản lý chương trình khách hàng thân thiết và khuyến mãi thông qua Management API và Integration API của TalonOne. Nó được Marketing Agent gọi đến trong bước thứ ba (tùy chọn) của quy trình.

## Vị trí

[`packages/agents/talonone/`](../../packages/agents/talonone/)

## Công nghệ sử dụng

- Python với FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- Factory A2A server dùng chung từ [`packages/agents/common`](../../packages/agents/common/)

## Điểm vào (Entry Point)

[`app/agent/main.py`](../../packages/agents/talonone/app/agent/main.py)

Dùng factory chung `create_a2a_app()` từ [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) để tạo một ứng dụng FastAPI phục vụ qua giao thức A2A.

## Định nghĩa Agent

[`app/agent/agent.py`](../../packages/agents/talonone/app/agent/agent.py)

Hàm `get_talonone_agent()` tạo một Strands Agent với:

- **MCP Gateway client** — kết nối tới `talonone-target` trên AgentCore Gateway bằng streamable HTTP được xác thực SigV4.
- **Built-in tools** — `current_time` từ `strands_tools`.
- **Cấu hình động** — nạp model ID và system prompt từ SSM Parameter Store.

## Các tool khả dụng

Agent có quyền truy cập mười một tool do TalonOne MCP Server expose:

| Tool                      | Mô tả                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| `list_campaigns`          | Liệt kê các chiến dịch khuyến mãi. Bộ lọc tùy chọn: state, page_size, skip.       |
| `get_campaign`            | Lấy chi tiết một chiến dịch theo campaign_id.                                     |
| `create_campaign`         | Tạo một chiến dịch khuyến mãi mới. Yêu cầu name.                                  |
| `get_customer_session`    | Lấy các phiên mua sắm của khách hàng theo customer_id.                           |
| `update_customer_session` | Cập nhật/tạo một phiên. Nhận customer_id, cart_items, state.                      |
| `get_loyalty_program`     | Lấy chi tiết chương trình loyalty hoặc liệt kê tất cả chương trình.              |
| `get_customer_loyalty`    | Lấy số dư loyalty của khách hàng. Yêu cầu customer_id và program_id.             |
| `redeem_points`           | Trừ điểm loyalty. Yêu cầu customer_id, program_id và points.                      |
| `list_coupons`            | Liệt kê coupon của một chiến dịch. Yêu cầu campaign_id.                          |
| `validate_coupon`         | Tìm một coupon theo coupon_code trên tất cả các chiến dịch.                       |
| `create_coupon`           | Tạo một coupon trong chiến dịch. Yêu cầu campaign_id, code, discount_type, value. |

## Hướng dẫn quy trình

1. Dùng `list_campaigns` để khám phá các chiến dịch khả dụng trước các thao tác khác.
2. Dùng `get_customer_session` trước khi thực hiện cập nhật.
3. Kiểm tra trạng thái loyalty bằng `get_customer_loyalty` trước khi trừ điểm.
4. Kiểm định coupon bằng `validate_coupon` trước khi áp dụng.
5. Khi tạo coupon, tìm campaign_id qua `list_campaigns` trước.
6. Chiến dịch mới được tạo với `state: "disabled"` theo mặc định để rà soát trước khi kích hoạt.

## Biến môi trường

- `GATEWAY_URL` — URL của AgentCore MCP Gateway
- `AGENT_CONFIG_PARAMETER` — tên tham số SSM cho cấu hình agent
- `AWS_REGION` — vùng AWS
