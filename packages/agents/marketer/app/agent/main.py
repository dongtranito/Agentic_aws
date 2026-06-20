# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import json

import uvicorn
from bedrock_agentcore.runtime.models import PingStatus
from common.s3_artifact import current_session_id
from fastapi import Header, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from .agent import get_agent
from .init import app
from .utils.a2a import SubAgentProgress


async def handle_invoke(prompt: str, session_id: str, actor_id: str):
    """Streaming handler for agent invocation.

    Yields SSE-formatted events:
      - data: {"type":"text","content":"..."} for text chunks
      - data: {"type":"tool_use","name":"...","input":{...}} when a tool starts
      - data: {"type":"tool_result","name":"...","output":"..."} when a tool completes
      - data: {"type":"subagent_progress","agent":"...","content":"..."} for subagent streaming

    [VI] Trình xử lý dạng streaming cho việc gọi agent.

    Phát ra các sự kiện theo định dạng SSE:
      - data: {"type":"text","content":"..."} cho các đoạn văn bản
      - data: {"type":"tool_use","name":"...","input":{...}} khi một công cụ bắt đầu chạy
      - data: {"type":"tool_result","name":"...","output":"..."} khi một công cụ hoàn tất
      - data: {"type":"subagent_progress","agent":"...","content":"..."} cho luồng streaming của subagent
    """
    current_session_id.set(session_id)
    with get_agent(session_id=session_id, actor_id=actor_id) as agent:
        pending_tool: dict | None = None
        last_tool_names: dict[str, str] = {}  # toolUseId -> tool_name
        stream = agent.stream_async(prompt)

        def flush_pending_tool():
            """Emit the pending tool_use event with accumulated input.

            [VI] Phát ra sự kiện tool_use đang chờ kèm theo dữ liệu đầu vào đã gom lại.
            """
            nonlocal pending_tool
            if pending_tool is None:
                return None
            evt = json.dumps(pending_tool)
            pending_tool = None
            return f"data: {evt}\n\n"

        async for event in stream:
            print(event)  # [VI] In ra sự kiện thô để gỡ lỗi (debug)

            # Tool use start/update — accumulate input, don't emit yet
            # [VI] Bắt đầu/cập nhật việc dùng công cụ — gom dữ liệu đầu vào, chưa phát ra vội
            tool_use = event.get("current_tool_use")
            if tool_use and tool_use.get("name"):
                raw_name = tool_use["name"]
                tool_name = raw_name.split("___", 1)[-1] if "___" in raw_name else raw_name

                if pending_tool and pending_tool["name"] != tool_name:
                    # Different tool — flush the previous one
                    # [VI] Công cụ khác — đẩy (flush) công cụ trước đó ra
                    flushed = flush_pending_tool()
                    if flushed:
                        yield flushed

                # Update pending tool with latest accumulated input
                # [VI] Cập nhật công cụ đang chờ với dữ liệu đầu vào mới nhất đã gom lại
                raw_input = tool_use.get("input", {})
                if isinstance(raw_input, str):
                    try:
                        raw_input = json.loads(raw_input)
                    except (json.JSONDecodeError, TypeError):
                        raw_input = {"raw": raw_input}
                pending_tool = {
                    "type": "tool_use",
                    "name": tool_name,
                    "input": raw_input,
                }
                last_tool_names[tool_use.get("toolUseId", "")] = tool_name
                continue

            # Any non-tool event: flush pending tool first
            # [VI] Mọi sự kiện không phải công cụ: đẩy công cụ đang chờ ra trước
            flushed = flush_pending_tool()
            if flushed:
                yield flushed

            # Subagent streaming progress via tool_stream_event
            # [VI] Tiến độ streaming của subagent thông qua tool_stream_event
            tool_stream = event.get("tool_stream_event")
            if tool_stream:
                data = tool_stream.get("data")
                if isinstance(data, SubAgentProgress):
                    evt = json.dumps(
                        {
                            "type": "subagent_progress",
                            "agent": data.agent_name,
                            "content": data.content,
                        }
                    )
                    yield f"data: {evt}\n\n"
                    continue

            # Complete message — check for tool results
            # [VI] Tin nhắn hoàn chỉnh — kiểm tra xem có kết quả từ công cụ không
            msg = event.get("message")
            if msg and msg.get("role") == "user":
                for block in msg.get("content", []):
                    if "toolResult" in block:
                        tr = block["toolResult"]
                        # Resolve tool name from tracked names or message
                        # [VI] Xác định tên công cụ từ danh sách đã theo dõi hoặc từ tin nhắn
                        tool_use_id = tr.get("toolUseId", "")
                        tool_name = last_tool_names.get(tool_use_id, "")
                        if not tool_name:
                            raw_tool_name = ""
                            for b in msg.get("content", []):
                                tu = b.get("toolUse")
                                if tu and tu.get("toolUseId") == tool_use_id:
                                    raw_tool_name = tu.get("name", "")
                                    break
                            if raw_tool_name:
                                tool_name = (
                                    raw_tool_name.split("___", 1)[-1] if "___" in raw_tool_name else raw_tool_name
                                )
                            else:
                                tool_name = "tool"
                        output = ""
                        for c in tr.get("content", []):
                            if "text" in c:
                                output += c["text"]
                        evt = json.dumps(
                            {
                                "type": "tool_result",
                                "name": tool_name,
                                "status": tr.get("status", "success"),
                                "output": output,
                            }
                        )
                        yield f"data: {evt}\n\n"
                continue

            # Text content
            # [VI] Nội dung văn bản
            content = event.get("data")
            if content is not None:
                evt = json.dumps({"type": "text", "content": content})
                yield f"data: {evt}\n\n"
                continue

            # Message stop
            # [VI] Tín hiệu kết thúc tin nhắn
            if event.get("event", {}).get("messageStop") is not None:
                pass


@app.post("/invocations", openapi_extra={"x-streaming": True}, response_class=PlainTextResponse)
async def invoke(
    request: Request,
    x_amzn_bedrock_agentcore_runtime_session_id: str = Header(
        default="default-session", alias="x-amzn-bedrock-agentcore-runtime-session-id"
    ),
) -> str:
    """Entry point for agent invocation"""
    # AgentCore sends payload as application/octet-stream, so we parse manually
    # [VI] Điểm vào (entry point) cho việc gọi agent.
    # [VI] AgentCore gửi payload dưới dạng application/octet-stream nên ta phải tự phân tích thủ công.
    body = await request.body()
    data = json.loads(body)
    prompt = data.get("prompt", "")
    actor_id = data.get("actorId", "anonymous")

    # [VI] In ra prompt đã nhận cùng session_id và actor_id để theo dõi/gỡ lỗi
    print(f"Received prompt: {prompt}, session_id: {x_amzn_bedrock_agentcore_runtime_session_id}, actor_id: {actor_id}")

    return StreamingResponse(
        handle_invoke(prompt, x_amzn_bedrock_agentcore_runtime_session_id, actor_id),
        media_type="text/event-stream",
    )


@app.get("/ping")
def ping() -> str:
    # TODO: if running an async task, return PingStatus.HEALTHY_BUSY
    # [VI] TODO: nếu đang chạy một tác vụ bất đồng bộ, hãy trả về PingStatus.HEALTHY_BUSY
    return PingStatus.HEALTHY


if __name__ == "__main__":
    uvicorn.run("app.agent.main:app", port=8080)
