# Tài liệu kỹ thuật

Nền tảng quản lý chiến dịch marketing dùng AI, xây dựng trên AWS. Người dùng tạo và quản lý chiến dịch marketing qua giao diện web, đồng thời tương tác với một AI agent qua chat để thực thi các tác vụ marketing trên Databricks, CleverTap và TalonOne.

## Kiến trúc

![architecture](../docs/architecture.jpg)

## Tài liệu thành phần

- [API Handlers](./components/api-handlers.md) — Các hàm Lambda cung cấp REST endpoint cho campaign, chat, cấu hình và kết quả SQL
- [Marketing Agent](./components/marketing-agent.md) — Agent điều phối trung tâm, dẫn dắt người dùng qua quy trình tạo chiến dịch
- [Databricks Agent](./components/databricks-agent.md) — Worker agent lo phân tích dữ liệu, truy vấn SQL và phân khúc đối tượng
- [CleverTap Agent](./components/clevertap-agent.md) — Worker agent quản lý vòng đời chiến dịch
- [TalonOne Agent](./components/talonone-agent.md) — Worker agent lo chương trình khách hàng thân thiết, khuyến mãi và coupon
- [MCP Servers](./components/mcp-servers.md) — Các MCP server chạy trên Lambda, đứng sau AgentCore Gateway
- [Hạ tầng](./components/infrastructure.md) — Stack AWS CDK, các construct và cấu hình triển khai
- [Web UI](./components/web-ui.md) — Frontend React/TypeScript dùng [Cloudscape Design System](https://cloudscape.design/)
- [Tiện ích chung cho Agent](./components/shared-agent-utilities.md) — Các tiện ích Python dùng chung cho A2A, gateway và cấu hình
- [Lưu trữ phiên](./components/session-persistence.md) — Cách các artifact hội thoại được lưu lên S3 ở tất cả các agent

## Sơ đồ tuần tự

- [Bước 1 — Định nghĩa đối tượng mục tiêu](./sequence-diagrams/sequence-step1-audience.txt)
- [Bước 2 — Tạo chiến dịch](./sequence-diagrams/sequence-step2-campaign.txt)
- [Bước 3 — Tạo khuyến mãi (tùy chọn)](./sequence-diagrams/sequence-step3-promotion.txt)

Sơ đồ tuần tự dùng cú pháp [swimlanes.io](https://swimlanes.io). Dán nội dung file vào trình soạn thảo để hiển thị.
