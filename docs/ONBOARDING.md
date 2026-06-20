# Onboarding — AI Engineer

Bản đồ định hướng theo task: "muốn làm X thì mở file nào, đọc theo thứ tự nào".
Tài liệu chi tiết từng thành phần nằm ở [`docs/components/`](./components/). File này tập trung vào *cách tìm đường* trong code.

## 1. Nguyên tắc định vị (nhớ 3 điều)

1. **Tầng nào?**
   - `packages/agents/` — AI / Python (Strands + Bedrock AgentCore). **Vùng chính của AI engineer.**
   - `packages/api/` — backend TypeScript (Lambda handlers + MCP servers).
   - `packages/web-ui/` — frontend React.
   - `packages/infra/` — AWS CDK (quyền, biến môi trường, deploy).
   - `packages/common/` — TypeScript dùng chung (api/infra/ui).
   - `packages/agents/common/` — Python dùng chung (các agent).

2. **Trong một agent, mỗi file một vai trò cố định:**
   - `init.py` — dựng FastAPI app (CORS, error handler). Hiếm khi đụng.
   - `agent.py` — **bộ não**: model + system prompt + tools + memory.
   - `main.py` — **cổng vào/ra**: HTTP endpoint, stream sự kiện.
   - `worker_agents/` — bọc agent khác thành tool (chỉ marketer có).
   - `utils/` — giao thức (A2A, ký SigV4).

3. **Hai loại lời gọi cần phân biệt:**
   - "Gọi agent khác" = **A2A call** → `marketer/app/agent/utils/a2a.py`.
   - "Gọi hệ thống ngoài" = **MCP call** → `agents/common/common/gateway.py` + `api/src/handlers/mcp/`.

> Quy luật ngầm: **Python = hành vi/trí tuệ agent. TypeScript = hạ tầng + API + MCP tool + UI.**
> Một tính năng agent thường đụng cả hai: logic ở `agents/`, quyền & wiring ở `infra/`.

## 2. Bảng tra "muốn làm X → mở file nào"

| Muốn làm | Mở file |
| --- | --- |
| Đổi cách agent suy nghĩ / quy trình / luật | `packages/agents/<agent>/app/agent/agent.py` (sửa `system_prompt`) |
| Đổi model hoặc prompt mà KHÔNG redeploy | Không sửa code — đổi trong SSM. Key đọc ở `agents/common/common/config.py` (`modelId`, `systemPrompt`) |
| Thêm/bớt tool cho agent | `agent.py`, sửa list `tools=[...]` |
| Thêm tool gọi agent khác | Tạo file trong `marketer/app/agent/worker_agents/` theo mẫu `databricks.py` |
| Thêm/sửa tool MCP (logic thật) | `packages/api/src/handlers/mcp/<provider>.ts` (TypeScript!) |
| Đổi cách worker kết nối hệ thống ngoài | `agents/<worker>/app/agent/agent.py` + `agents/common/common/gateway.py` |
| Đổi cách stream về UI (SSE event) | `marketer/app/agent/main.py` → `handle_invoke()` |
| Sửa giao tiếp orchestrator ↔ worker (A2A) | `marketer/app/agent/utils/a2a.py` (+ `utils/sigv4_auth.py`) |
| Sửa ghi artifact hội thoại lên S3 | `agents/common/common/s3_artifact.py` (+ đăng ký hook trong `agent.py`) |
| Một REST endpoint trả sai | `packages/api/src/handlers/api/<tênEndpoint>.ts` |
| Đổi hình dạng dữ liệu API | `packages/api/src/schema/` |
| UI sai / đổi màn hình | Trang: `web-ui/src/routes/` · Thành phần: `web-ui/src/components/<Feature>/` · Gọi API: `web-ui/src/hooks/` |
| Agent thiếu quyền IAM / sai env / cần resource | `packages/infra/src/constructs/agents/<agent>.ts` · Storage chung: `constructs/storage-data.ts` · Gateway: `constructs/gateway/` |

## 3. Cách đọc một agent lạ (luôn theo thứ tự)

1. `agent.py` trước — xem nó là ai (system prompt), có tool gì, dùng memory/config nào. Đây là ~80% sự hiểu biết.
2. `main.py` — nhận request kiểu gì, trả ra kiểu gì (worker dùng `create_a2a_app`; marketer tự định nghĩa `/invocations`).
3. `worker_agents/` hoặc `utils/` — chỉ khi cần chi tiết một tool/giao thức cụ thể.

## 4. Trace mẫu: "Phân khúc của tôi có bao nhiêu người?"

Mỗi bước là một file thật, theo đúng thứ tự được chạm:

1. **UI gửi prompt** — `web-ui/src/components/Chat/` → hook `web-ui/src/hooks/useApi.tsx` → `PUT /chat`.
2. **API chuyển tiếp** — `api/src/handlers/api/putChat.ts`: lấy `actorId` từ JWT, gọi `InvokeAgentRuntimeCommand` tới marketer. Handler là streaming, chỉ làm ống dẫn.
3. **Marketer nhận** — `agents/marketer/app/agent/main.py` `/invocations`: `agent.stream_async()` + `handle_invoke()` dịch event thô → SSE.
4. **Agent chọn worker** — `agents/marketer/app/agent/agent.py`: system prompt bảo "Bước 1 dùng databricks_agent".
5. **Tool = A2A call** — `worker_agents/databricks.py` → `utils/a2a.py` (`stream_a2a_agent`), ký SigV4 ở `utils/sigv4_auth.py`. Tiến trình về dạng `SubAgentProgress` → event `subagent_progress` ở UI.
6. **Databricks worker** — `agents/databricks/app/agent/main.py` (dùng `create_a2a_app`) → `agent.py` chọn tool `execute_sql`/`list_tables`.
7. **Tool = MCP call** — `agents/common/common/gateway.py` (lọc prefix `databricks-target___`) → MCP server thật `api/src/handlers/mcp/databricks.ts` → API Databricks.
8. **Chảy ngược về** — worker → (A2A) marketer → (SSE) `putChat.ts` → UI. Lịch sử load qua `api/src/handlers/api/getChatHistory.ts` (đọc AgentCore Memory).

Song song: `infra/src/constructs/agents/marketer.ts` gán env (`DATABRICKS_A2A_ENDPOINT`, `MEMORY_ID`...) + IAM. Lỗi thiếu quyền/sai endpoint → mở file infra này, không phải file Python.

## 5. Lệnh hay dùng (Nx + uv)

```bash
# Cài deps cho một agent
nx run play_c463_z26_rzy_mar_tech.marketer:install
# Chạy agent local (FastAPI dev, port 8081)
nx run play_c463_z26_rzy_mar_tech.marketer:agent-serve
# Test
nx run play_c463_z26_rzy_mar_tech.marketer:test
# Lint / format
nx run play_c463_z26_rzy_mar_tech.marketer:lint
```

Biến môi trường cần để chạy local (xem [`docs/components/marketing-agent.md`](./components/marketing-agent.md)):
`MEMORY_ID`, `DATABRICKS_A2A_ENDPOINT`, `CLEVERTAP_A2A_ENDPOINT`, `TALONONE_A2A_ENDPOINT`, `GATEWAY_URL`, `ARTIFACT_BUCKET`, `AGENT_CONFIG_PARAMETER`. Giá trị tới từ stack đã deploy (`packages/infra`) — hỏi team nơi lấy bộ env/credentials dev.

## 6. Mẹo tìm nhanh

- Tìm nơi một env var được dùng VÀ được gán: search tên var (vd `DATABRICKS_A2A_ENDPOINT`) → thấy cả `agents/` (đọc) lẫn `infra/` (gán).
- Tìm system prompt: search `system_prompt` trong `packages/agents`.
- Tìm một tool theo tên (vd `execute_sql`): search trong `packages/api/src/handlers/mcp`.
- README trong từng package gần như trống — nguồn thật là `docs/components/`.
