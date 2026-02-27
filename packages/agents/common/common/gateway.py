"""AgentCore Gateway MCP Client with SigV4 authentication.

Shared factory for creating MCP clients that connect to AgentCore Gateway
and filter tools by gateway target name.
"""

import hashlib
import os
import re
from collections.abc import Generator
from typing import Any

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient


class SigV4HTTPXAuth(httpx.Auth):
    """HTTPX Auth class that signs requests with AWS SigV4."""

    def __init__(self, credentials: Any, region: str):
        self.credentials = credentials
        self.service = "bedrock-agentcore"
        self.region = region
        self.signer = SigV4Auth(credentials, self.service, region)

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        headers = dict(request.headers)
        headers.pop("connection", None)
        headers["x-amz-content-sha256"] = hashlib.sha256(request.content if request.content else b"").hexdigest()

        aws_request = AWSRequest(
            method=request.method,
            url=str(request.url),
            data=request.content,
            headers=headers,
        )
        self.signer.add_auth(aws_request)

        request.headers.clear()
        request.headers.update(dict(aws_request.headers))
        yield request


def get_gateway_mcp_client(target_name: str) -> MCPClient:
    """Create an MCP Client for a specific gateway target.

    Connects to the AgentCore Gateway using SigV4 auth and filters
    tools to only those belonging to the specified target.

    Args:
        target_name: The gateway target name (e.g. 'databricks-target').
            Tools are filtered by the pattern '{target_name}___'.
    """
    gateway_url = os.environ["GATEWAY_URL"]
    region = os.environ.get("AWS_REGION", "us-east-1")

    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    return MCPClient(
        lambda: streamablehttp_client(
            gateway_url,
            auth=SigV4HTTPXAuth(credentials, region),
            timeout=120,
        ),
        tool_filters={"allowed": [re.compile(rf"^{re.escape(target_name)}___")]},
    )
