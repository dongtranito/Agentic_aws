import json

import uvicorn
from bedrock_agentcore.runtime.models import PingStatus
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
    """
    with get_agent(session_id=session_id, actor_id=actor_id) as agent:
        pending_tool: dict | None = None
        last_tool_names: dict[str, str] = {}  # toolUseId -> tool_name
        stream = agent.stream_async(prompt)

        def flush_pending_tool():
            """Emit the pending tool_use event with accumulated input."""
            nonlocal pending_tool
            if pending_tool is None:
                return None
            evt = json.dumps(pending_tool)
            pending_tool = None
            return f"data: {evt}\n\n"

        async for event in stream:
            print(event)

            # Tool use start/update — accumulate input, don't emit yet
            tool_use = event.get("current_tool_use")
            if tool_use and tool_use.get("name"):
                raw_name = tool_use["name"]
                tool_name = raw_name.split("___", 1)[-1] if "___" in raw_name else raw_name

                if pending_tool and pending_tool["name"] != tool_name:
                    # Different tool — flush the previous one
                    flushed = flush_pending_tool()
                    if flushed:
                        yield flushed

                # Update pending tool with latest accumulated input
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
            flushed = flush_pending_tool()
            if flushed:
                yield flushed

            # Subagent streaming progress via tool_stream_event
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
            msg = event.get("message")
            if msg and msg.get("role") == "user":
                for block in msg.get("content", []):
                    if "toolResult" in block:
                        tr = block["toolResult"]
                        # Resolve tool name from tracked names or message
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
            content = event.get("data")
            if content is not None:
                evt = json.dumps({"type": "text", "content": content})
                yield f"data: {evt}\n\n"
                continue

            # Message stop
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
    body = await request.body()
    data = json.loads(body)
    prompt = data.get("prompt", "")
    actor_id = data.get("actorId", "anonymous")

    print(f"Received prompt: {prompt}, session_id: {x_amzn_bedrock_agentcore_runtime_session_id}, actor_id: {actor_id}")

    return StreamingResponse(
        handle_invoke(prompt, x_amzn_bedrock_agentcore_runtime_session_id, actor_id),
        media_type="text/event-stream",
    )


@app.get("/ping")
def ping() -> str:
    # TODO: if running an async task, return PingStatus.HEALTHY_BUSY
    return PingStatus.HEALTHY


if __name__ == "__main__":
    uvicorn.run("app.agent.main:app", port=8080)
