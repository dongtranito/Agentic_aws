"""A2A utility helpers for AgentCore runtimes.

Uses the Strands A2AAgent class for protocol communication, with
custom SigV4 auth and boto3-based agent card discovery for
AgentCore Runtime endpoints.

Reference: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/agent-to-agent
"""

import logging
from urllib.parse import quote
from uuid import uuid4

import boto3
import httpx
from a2a.client import ClientConfig, ClientFactory
from a2a.types import AgentCard
from strands.agent.a2a_agent import A2AAgent, run_async

from .sigv4_auth import SigV4HTTPXAuth

logger = logging.getLogger(__name__)


def _build_endpoint_url(agent_runtime_arn: str, region: str) -> str:
    """Build the AgentCore Runtime invocation URL from an ARN."""
    encoded_arn = quote(agent_runtime_arn, safe="")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations/"


def _get_agent_card(agent_runtime_arn: str, region: str) -> AgentCard:
    """Fetch agent card via boto3 SDK (avoids HTTP auth issues on card fetch)."""
    client = boto3.client("bedrock-agentcore", region_name=region)
    response = client.get_agent_card(agentRuntimeArn=agent_runtime_arn)
    card_dict = response.get("agentCard", {})
    if not card_dict:
        raise ValueError(f"No agent card found for {agent_runtime_arn}")
    return AgentCard(**card_dict)


def _build_client_factory(region: str, session_id: str) -> ClientFactory:
    """Build an A2A ClientFactory with SigV4 auth for AgentCore Runtime."""
    session = boto3.Session()
    credentials = session.get_credentials()
    auth = SigV4HTTPXAuth(credentials, region)

    headers = {
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session_id,
    }
    httpx_client = httpx.AsyncClient(timeout=300, auth=auth, headers=headers)

    config = ClientConfig(httpx_client=httpx_client, streaming=True)
    return ClientFactory(config)


def build_a2a_agent(agent_runtime_arn: str, region: str) -> A2AAgent:
    """Build a Strands A2AAgent for an AgentCore Runtime endpoint.

    Uses boto3 for agent card discovery (AgentCore returns 403 on HTTP
    card fetch) and a custom ClientFactory with SigV4 auth for the
    actual A2A JSON-RPC communication.
    """
    endpoint_url = _build_endpoint_url(agent_runtime_arn, region)

    # Ensure session ID is >= 33 characters (AgentCore requirement)
    session_id = uuid4().hex + "-" + uuid4().hex[:8]

    client_factory = _build_client_factory(region, session_id)

    # Fetch agent card via boto3 (not HTTP)
    agent_card = _get_agent_card(agent_runtime_arn, region)

    a2a_agent = A2AAgent(
        endpoint=endpoint_url,
        name=agent_card.name,
        description=agent_card.description,
        a2a_client_factory=client_factory,
        timeout=300,
    )

    # Pre-populate the cached agent card so A2AAgent skips HTTP-based
    # card resolution (which would fail with 403 on AgentCore).
    a2a_agent._agent_card = agent_card

    return a2a_agent


def invoke_a2a_agent(
    agent_runtime_arn: str,
    region: str,
    prompt: str,
) -> str:
    """Invoke a remote A2A agent on AgentCore Runtime with streaming.

    Uses A2AAgent.stream_async to consume streamed A2A events, collecting
    text as it arrives and returning the final assembled response.
    """
    a2a_agent = build_a2a_agent(agent_runtime_arn, region)

    async def _stream() -> str:
        response_text = ""
        async for event in a2a_agent.stream_async(prompt):
            if "result" in event:
                # Final event — extract text from the AgentResult
                content = event["result"].message.get("content", [])
                texts = [part["text"] for part in content if "text" in part]
                if texts:
                    response_text = "\n".join(texts)
            elif event.get("type") == "a2a_stream" and "data" in event:
                # Intermediate streamed text chunk
                response_text += event["data"]
        return response_text or "Task completed successfully"

    return run_async(lambda: _stream())
