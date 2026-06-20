# Databricks Agent

Databricks Agent là một worker agent cung cấp năng lực phân tích dữ liệu. Nó kết nối tới các tool Databricks được expose qua AgentCore MCP Gateway và được Marketing Agent gọi đến trong bước định nghĩa đối tượng.

## Vị trí

[`packages/agents/databricks/`](../../packages/agents/databricks/)

## Công nghệ sử dụng

- Python với FastAPI
- [Strands Agents framework](https://strandsagents.com)
- Bedrock AgentCore Runtime
- Factory A2A server dùng chung từ [`packages/agents/common`](../../packages/agents/common/)

## Điểm vào (Entry Point)

[`app/agent/main.py`](../../packages/agents/databricks/app/agent/main.py)

Dùng factory chung `create_a2a_app()` từ [`common.a2a_server`](../../packages/agents/common/common/a2a_server.py) để tạo một ứng dụng FastAPI phục vụ agent qua giao thức A2A. Factory này bọc agent trong một `A2AServer` của Strands và gắn nó lên ứng dụng FastAPI cùng một endpoint kiểm tra sức khỏe `/ping`.

## Định nghĩa Agent

[`app/agent/agent.py`](../../packages/agents/databricks/app/agent/agent.py)

Hàm `get_databricks_agent()` tạo một Strands Agent với:

- **MCP Gateway client** — kết nối tới `databricks-target` trên AgentCore Gateway bằng streamable HTTP được xác thực SigV4. Tool được lọc theo tiền tố `databricks-target___`.
- **Built-in tools** — `current_time` từ `strands_tools`.
- **Cấu hình động** — nạp model ID và system prompt từ SSM Parameter Store.

## Các tool khả dụng

Agent có quyền truy cập tám tool do Databricks MCP Server expose:

| Tool                   | Mô tả                                                          |
| ---------------------- | -------------------------------------------------------------- |
| `execute_sql`          | Thực thi truy vấn SQL trên một Databricks SQL warehouse        |
| `get_statement_result` | Thăm dò kết quả của các câu lệnh SQL chạy lâu                  |
| `list_warehouses`      | Liệt kê các SQL warehouse khả dụng để tìm warehouse ID         |
| `list_schemas`         | Liệt kê các schema trong một catalog Unity Catalog             |
| `list_tables`          | Liệt kê các bảng trong một schema Unity Catalog                |
| `get_table`            | Lấy chi tiết bảng gồm tên cột và kiểu dữ liệu                  |
| `run_job`              | Kích hoạt một lần chạy job Databricks                          |
| `get_job_run`          | Kiểm tra trạng thái một lần chạy job Databricks                |

## Hướng dẫn quy trình

System prompt của agent chỉ dẫn nó:

1. Dùng `list_warehouses` để tìm warehouse khả dụng nếu chưa có warehouse nào được cung cấp.
2. Dùng `list_schemas` và `list_tables` để khám phá dữ liệu trước khi viết truy vấn.
3. Dùng `get_table` để hiểu tên cột và kiểu dữ liệu trước khi dựng SQL.
4. Với truy vấn SQL, dùng `execute_sql` và thăm dò bằng `get_statement_result` nếu kết quả còn đang chờ.
5. Thông báo cho người dùng vị trí S3 của kết quả đầy đủ khi kết quả bị cắt bớt.

## Biến môi trường

- `GATEWAY_URL` — URL của AgentCore MCP Gateway
- `AGENT_CONFIG_PARAMETER` — tên tham số SSM cho cấu hình agent
- `AWS_REGION` — vùng AWS
