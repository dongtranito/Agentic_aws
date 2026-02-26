"""A2A utility helpers for AgentCore runtimes.

Based on: aws-samples/sample-strands-agent-with-agentcore
"""

import asyncio
import logging
from urllib.parse import quote
from uuid import uuid4

import boto3
import httpx
from a2a.client import ClientConfig, ClientFactory
from a2a.types import AgentCard, Message, Part, Role, TextPart

from .sigv4_auth import SigV4HTTPXAuth

logger = logging.getLogger(__name__)


def _build_endpoint_url(agent_runtime_arn: str, region: str) -> str:
    """Build the AgentCore Runtime invocation URL from an ARN."""
    encoded_arn = quote(agent_runtime_arn, safe="")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations/"


def _get_agent_card(agent_runtime_arn: str, region: str) -> AgentCard:
    """Fetch agent card via boto3 SDK (avoids HTTP auth issues)."""
    client = boto3.client("bedrock-agentcore", region_name=region)
    response = client.get_agent_card(agentRuntimeArn=agent_runtime_arn)
    card_dict = response.get("agentCard", {})
    if not card_dict:
        raise ValueError(f"No agent card found for {agent_runtime_arn}")
    return AgentCard(**card_dict)


def _build_httpx_client(region: str, session_id: str) -> httpx.AsyncClient:
    """Create an httpx client with SigV4 auth and session header."""
    session = boto3.Session()
    credentials = session.get_credentials()
    auth = SigV4HTTPXAuth(credentials, region)

    headers = {
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session_id,
    }
    return httpx.AsyncClient(timeout=300, auth=auth, headers=headers)


async def invoke_a2a_agent(
    agent_runtime_arn: str,
    region: str,
    prompt: str,
) -> str:
    """Invoke a remote A2A agent on AgentCore Runtime.

    Uses boto3 for agent card discovery and httpx with SigV4 for
    the actual A2A JSON-RPC communication.
    """
    # Ensure session ID is >= 33 characters (AgentCore requirement)
    session_id = uuid4().hex + "-" + uuid4().hex[:8]

    # Fetch agent card via boto3 (not HTTP — avoids 403 on card fetch)
    agent_card = await asyncio.get_event_loop().run_in_executor(None, _get_agent_card, agent_runtime_arn, region)

    httpx_client = _build_httpx_client(region, session_id)

    try:
        config = ClientConfig(httpx_client=httpx_client, streaming=True)
        factory = ClientFactory(config)
        client = factory.create(agent_card)

        msg = Message(
            kind="message",
            role=Role.user,
            parts=[Part(TextPart(kind="text", text=prompt))],
            message_id=uuid4().hex,
        )

        response_text = ""
        async for event in client.send_message(msg):
            if isinstance(event, Message):
                for part in event.parts:
                    if hasattr(part, "root") and hasattr(part.root, "text"):
                        response_text += part.root.text
                    elif hasattr(part, "text"):
                        response_text += part.text
                break

            elif isinstance(event, tuple) and len(event) == 2:
                task, update_event = event
                task_status = task.status if hasattr(task, "status") else task
                state = str(task_status.state if hasattr(task_status, "state") else "unknown")

                # Accumulate text from status message
                if hasattr(task_status, "message") and task_status.message:
                    msg_obj = task_status.message
                    if hasattr(msg_obj, "parts") and msg_obj.parts:
                        p = msg_obj.parts[0]
                        if hasattr(p, "root") and hasattr(p.root, "text"):
                            response_text += p.root.text
                        elif hasattr(p, "text"):
                            response_text += p.text

                # Extract text artifacts on completion
                if "completed" in state:
                    if hasattr(task, "artifacts") and task.artifacts:
                        for artifact in task.artifacts:
                            if hasattr(artifact, "parts") and artifact.parts:
                                for p in artifact.parts:
                                    txt = ""
                                    if hasattr(p, "root") and hasattr(p.root, "text"):
                                        txt = p.root.text
                                    elif hasattr(p, "text"):
                                        txt = p.text
                                    if txt:
                                        response_text += txt
                    break

                if "failed" in state:
                    raise RuntimeError(f"Remote agent task failed: {response_text}")

                if update_event and hasattr(update_event, "final") and update_event.final:
                    break

        return response_text or "Task completed successfully"

    finally:
        await httpx_client.aclose()
