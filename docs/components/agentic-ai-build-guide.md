# Agentic AI Build Guide (End-to-End)

Tài liệu này tổng hợp theo đúng luồng bạn cần để hiểu và build hệ thống agentic AI trong repo.

## 1) Cấu trúc agent services (clevertap, databricks, talonone, marketer)

Các agent nằm trong `packages/agents/`:

- `clevertap/`, `databricks/`, `talonone/`: worker agents
- `marketer/`: orchestrator agent (điều phối workflow)
- `common/`: shared utilities dùng chung

Điểm khác biệt chính:

- **3 worker agents** dùng chung app factory `create_a2a_app(...)` từ `packages/agents/common/common/a2a_server.py`.
- **marketer agent** có custom app riêng (endpoint `/invocations`) tại `packages/agents/marketer/app/agent/main.py` để stream SSE về API.

## 2) Agent được khởi tạo và cấu hình như thế nào

### Worker agents

- Entry point:
  - `packages/agents/databricks/app/agent/main.py`
  - `packages/agents/clevertap/app/agent/main.py`
  - `packages/agents/talonone/app/agent/main.py`
- Agent definition:
  - `.../app/agent/agent.py` của từng agent

Pattern chung:

1. Tạo MCP client qua `common.gateway.get_gateway_mcp_client(target_name)`
2. `with mcp_client:` rồi `mcp_client.list_tools_sync()`
3. Tạo Strands `Agent(...)` với:
   - `model=config.get("modelId")`
   - `system_prompt=config.get("systemPrompt")` (hoặc default prompt)
   - `tools=[...mcp_tools..., current_time]`
4. Config được load động từ SSM qua `common.config.load_configuration()`

### Marketer (orchestrator)

- Agent factory ở `packages/agents/marketer/app/agent/agent.py` (`get_agent(session_id, actor_id)`):
  - Khởi tạo `AgentCoreMemoryConfig` + `AgentCoreMemorySessionManager`
  - Inject 3 tool wrapper gọi sub-agent:
    - `build_databricks_tool(...)`
    - `build_clevertap_tool(...)`
    - `build_talonone_tool(...)`
  - Load config model/system prompt từ SSM
  - Tạo Strands `Agent(...)` + đăng ký S3 artifact hook

## 3) Cách tích hợp với AWS Bedrock

### API -> Marketer runtime

- `packages/api/src/handlers/api/putChat.ts` dùng:
  - `BedrockAgentCoreClient`
  - `InvokeAgentRuntimeCommand`
- Gửi payload `{ prompt, actorId }` và `runtimeSessionId`, stream ngược lại SSE cho frontend.

### Agent -> Bedrock AgentCore Gateway/Runtime

- `packages/agents/common/common/gateway.py`:
  - MCP client gọi Gateway URL (`GATEWAY_URL`)
  - SigV4 signing service `bedrock-agentcore`
  - Filter tool theo prefix `{target}___`
- `packages/agents/marketer/app/agent/utils/a2a.py`:
  - Build endpoint runtime từ ARN
  - Lấy agent card bằng boto3 `get_agent_card`
  - Stream sang sub-agent bằng `A2AAgent.stream_async(...)`

## 4) Cách sử dụng Strands Agents framework

Các điểm Strands chính trong repo:

- `Agent(...)` để tạo agent cốt lõi (worker + marketer)
- `@tool` để expose wrapper tools (marketer gọi worker)
- `A2AServer` để serve worker agent qua protocol A2A (`common/a2a_server.py`)
- `A2AAgent` để marketer gọi runtime của worker agent (`marketer/.../utils/a2a.py`)
- `agent.stream_async(prompt)` để stream event realtime

## 5) Cách agents giao tiếp qua common utilities

Utilities chung trong `packages/agents/common/common/`:

- `a2a_server.py`: app factory + `/ping` + middleware set session id
- `gateway.py`: MCP Gateway client + SigV4 auth + tool filtering
- `config.py`: load model/system prompt từ SSM Parameter Store
- `s3_artifact.py`: lưu artifact hội thoại lên S3

Luồng giao tiếp:

1. Worker agent chỉ thấy tool của target mình nhờ prefix filter.
2. Marketer gọi worker qua A2A runtime ARN, giữ nguyên session id để liên tục context.
3. Event progress được wrap thành `SubAgentProgress` rồi stream ngược lên UI.

## 6) Cách API server (`packages/api`) gọi agents

File quan trọng:

- `packages/api/src/handlers/api/putChat.ts`:
  - Nhận request `PUT /chat` từ UI
  - Extract user id (`sub`) từ Cognito token -> `actorId`
  - Gọi `InvokeAgentRuntimeCommand` tới marketer runtime (`AGENT_RUNTIME_ARN`)
  - Stream raw chunks trả về client

- `packages/api/src/handlers/api/getChatHistory.ts`:
  - Đọc lịch sử từ AgentCore Memory
  - Normalize content blocks (`text`, `toolUse`, `toolResult`) để UI render ổn định

## 7) Cách web-ui gửi request đến agents

Luồng frontend:

1. `packages/web-ui/src/components/Chat/Chat.tsx`
   - Load history: `api.chat.getHistory(campaignId)`
   - Send message: `api.chat.put({ sessionId, prompt }, onChunk)`
2. `packages/web-ui/src/components/ApiClientProvider.tsx`
   - `chat.put` gọi `PUT /chat`
   - Đọc `response.body.getReader()` theo stream
3. `Chat.tsx` parse từng dòng `data: ...` SSE và render block:
   - `text`
   - `tool_use`
   - `tool_result`
   - `subagent_progress`

## Tóm tắt nhanh: nên đọc theo thứ tự nào

1. `packages/agents/marketer/app/agent/agent.py`
2. `packages/agents/marketer/app/agent/main.py`
3. `packages/agents/marketer/app/agent/utils/a2a.py`
4. `packages/agents/common/common/{a2a_server.py,gateway.py,config.py}`
5. `packages/agents/{databricks,clevertap,talonone}/app/agent/agent.py`
6. `packages/api/src/handlers/api/{putChat.ts,getChatHistory.ts}`
7. `packages/web-ui/src/components/{ApiClientProvider.tsx,Chat/Chat.tsx}`
