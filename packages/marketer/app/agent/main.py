import json

import uvicorn
from bedrock_agentcore.runtime.models import PingStatus
from fastapi import Header, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from .agent import get_agent
from .init import app


async def handle_invoke(prompt: str, session_id: str, actor_id: str):
    """Streaming handler for agent invocation"""
    with get_agent(session_id=session_id, actor_id=actor_id) as agent:
        stream = agent.stream_async(prompt)
        async for event in stream:
            print(event)
            content = event.get("event", {}).get("contentBlockDelta", {}).get("delta", {}).get("text")
            if content is not None:
                yield content
            elif event.get("event", {}).get("messageStop") is not None:
                yield "\n"


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
