"""A2A utility helpers for AgentCore runtimes."""

from urllib.parse import quote
from uuid import uuid4

import boto3
import httpx
from a2a.client import ClientConfig, ClientFactory

from .sigv4_auth import SigV4HTTPXAuth


def build_endpoint_url(agent_runtime_arn: str, region: str) -> str:
    """Build the AgentCore Runtime invocation URL from an ARN."""
    encoded_arn = quote(agent_runtime_arn, safe="")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations/"


def build_sigv4_client_factory(region: str) -> ClientFactory:
    """Create an A2A ClientFactory with SigV4 authentication.

    Includes the required X-Amzn-Bedrock-AgentCore-Runtime-Session-Id header
    for AgentCore runtime invocations.
    """
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()
    auth = SigV4HTTPXAuth(credentials, region)

    headers = {
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": uuid4().hex,
    }
    httpx_client = httpx.AsyncClient(timeout=300, auth=auth, headers=headers)
    config = ClientConfig(httpx_client=httpx_client, streaming=True)
    return ClientFactory(config)
