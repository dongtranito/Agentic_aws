# MCP Servers

Prototype này cung cấp ba MCP (Model Context Protocol) server tự xây dựng, được triển khai dưới dạng hàm AWS Lambda. Chúng được triển khai phía sau Amazon Bedrock AgentCore Gateway — nơi định tuyến các lời gọi tool từ agent tới đúng Lambda target. Mỗi server lấy thông tin xác thực của bên thứ ba từ AWS Secrets Manager và gọi API ngoài tương ứng.

## Vị trí

[`packages/api/src/handlers/mcp/`](../../packages/api/src/handlers/mcp/)

## Tiện ích dùng chung

[`packages/api/src/handlers/mcp/utils/index.ts`](../../packages/api/src/handlers/mcp/utils/index.ts)

- `extractToolName(fullToolName)` — lược bỏ tiền tố target của gateway khỏi tên tool. Gateway dùng định dạng `{target_name}___{tool_name}` (ba dấu gạch dưới).
- `getSecret<T>(secretArn)` — lấy và cache một secret JSON từ Secrets Manager. Kết quả được cache trong suốt vòng đời của ngữ cảnh thực thi Lambda.
- `GatewayContext` — interface TypeScript cho ngữ cảnh gọi của AgentCore Gateway, gồm tool name, message version, request ID, gateway ID và target ID.

## Databricks MCP Server

[`packages/api/src/handlers/mcp/databricks.ts`](../../packages/api/src/handlers/mcp/databricks.ts)

Triển khai các lời gọi Databricks API qua SQL Statement Execution, SQL Warehouses, Unity Catalog và Jobs API.

**Thông tin xác thực:** Lưu trong Secrets Manager dưới dạng `{ url, token }` (URL workspace Databricks và Personal Access Token).

**Biến môi trường:**

- `DATABRICKS_SECRET_ARN` — ARN Secrets Manager cho thông tin xác thực Databricks
- `SQL_RESULTS_BUCKET` — S3 bucket để tải lên các kết quả SQL lớn

**Các tool (8):**

| Tool                   | API                                        | Mô tả                                                            |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `execute_sql`          | POST `/api/2.0/sql/statements`             | Thực thi một truy vấn SQL. Hỗ trợ catalog, schema, row_limit tùy chọn. |
| `get_statement_result` | GET `/api/2.0/sql/statements/{id}`         | Thăm dò kết quả của một câu lệnh đang chờ/đang chạy.             |
| `list_warehouses`      | GET `/api/2.0/sql/warehouses`              | Liệt kê tất cả SQL warehouse khả dụng.                          |
| `list_schemas`         | GET `/api/2.1/unity-catalog/schemas`       | Liệt kê các schema trong một catalog.                           |
| `list_tables`          | GET `/api/2.1/unity-catalog/tables`        | Liệt kê các bảng trong một schema.                              |
| `get_table`            | GET `/api/2.1/unity-catalog/tables/{name}` | Lấy chi tiết bảng (cột, kiểu dữ liệu).                          |
| `run_job`              | POST `/api/2.1/jobs/run-now`               | Kích hoạt một lần chạy job Databricks.                          |
| `get_job_run`          | GET `/api/2.1/jobs/runs/get`               | Kiểm tra trạng thái lần chạy job.                               |

**Cắt bớt kết quả:** Kết quả SQL vượt quá 20 dòng hoặc 10KB sẽ bị cắt bớt. Kết quả đầy đủ được tải lên S3 dưới dạng JSON, và phản hồi bao gồm một object `_truncated` với `total_rows`, `preview_rows`, `full_result_s3_uri` và `full_result_bytes`.

## CleverTap MCP Server

[`packages/api/src/handlers/mcp/clevertap.ts`](../../packages/api/src/handlers/mcp/clevertap.ts)

Triển khai quản lý chiến dịch CleverTap qua CleverTap Targets API.

**Thông tin xác thực:** Lưu trong Secrets Manager dưới dạng `{ projectId, passcode, region }`.

**Biến môi trường:**

- `CLEVERTAP_SECRET_ARN` — ARN Secrets Manager cho thông tin xác thực CleverTap

**Các tool (6):**

| Tool                     | API                           | Mô tả                                                                       |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------- |
| `create_draft_campaign`  | POST `/1/targets/create.json` | Tạo một bản nháp với `estimate_only=true`. Trả về tầm tiếp cận ước tính.    |
| `confirm_draft_campaign` | POST `/1/targets/create.json` | Xác nhận một bản nháp với `estimate_only=false`. Thực sự tạo chiến dịch.    |
| `list_draft_campaigns`   | POST `/1/targets/list.json`   | Liệt kê chiến dịch trong một khoảng thời gian (from/to dạng YYYYMMDD).      |
| `get_draft_campaign`     | POST `/1/targets/result.json` | Lấy chi tiết đầy đủ của một bản nháp theo campaign ID.                      |
| `update_draft_campaign`  | POST `/1/targets/create.json` | Kiểm định lại một bản nháp với tham số cập nhật (`estimate_only=true`).     |
| `discard_draft_campaign` | POST `/1/targets/stop.json`   | Xóa vĩnh viễn một bản nháp.                                                 |

**Targeting đối tượng:** Server chuyển đổi `user_property_filters` (mảng các `{ name, operator, value }`) sang ngôn ngữ truy vấn của CleverTap (`common_profile_properties.profile_fields`). Hỗ trợ các bộ lọc tùy chọn dựa trên sự kiện với `event_name`, `from` và khoảng ngày `to`.

**Các kênh được hỗ trợ:** push, email, sms, webpush, whatsapp, webhook.

## TalonOne MCP Server

[`packages/api/src/handlers/mcp/talonone.ts`](../../packages/api/src/handlers/mcp/talonone.ts)

Triển khai quản lý chiến dịch, loyalty và coupon của TalonOne qua cả Management API lẫn Integration API.

**Thông tin xác thực:** Lưu trong Secrets Manager dưới dạng `{ baseUrl, applicationId, managementKey, integrationKey }`.

**Biến môi trường:**

- `TALONONE_SECRET_ARN` — ARN Secrets Manager cho thông tin xác thực TalonOne

**Các tool (11):**

| Tool                      | Loại API    | Mô tả                                                               |
| ------------------------- | ----------- | ------------------------------------------------------------------- |
| `list_campaigns`          | Management  | Liệt kê chiến dịch khuyến mãi với bộ lọc state và phân trang tùy chọn. |
| `get_campaign`            | Management  | Lấy chi tiết chiến dịch theo ID.                                    |
| `create_campaign`         | Management  | Tạo một chiến dịch mới (mặc định trạng thái `disabled`).            |
| `get_customer_session`    | Management  | Lấy các phiên khách hàng theo profile integration ID.              |
| `update_customer_session` | Integration | Cập nhật/tạo một phiên khách hàng với cart items và state.          |
| `get_loyalty_program`     | Management  | Lấy một chương trình loyalty cụ thể hoặc liệt kê tất cả.           |
| `get_customer_loyalty`    | Management  | Lấy số dư sổ cái loyalty của khách hàng.                           |
| `redeem_points`           | Management  | Trừ điểm loyalty khỏi số dư của khách hàng.                        |
| `list_coupons`            | Management  | Liệt kê coupon của một chiến dịch.                                 |
| `validate_coupon`         | Management  | Tìm một coupon theo code trên tất cả các chiến dịch.               |
| `create_coupon`           | Management  | Tạo một coupon trong chiến dịch với code, loại giảm giá và giá trị. |

**Xác thực:** Management API dùng phân quyền `ManagementKey-v1`. Integration API dùng phân quyền `ApiKey-v1`. Cả hai key đều được lưu trong cùng một secret của Secrets Manager.
