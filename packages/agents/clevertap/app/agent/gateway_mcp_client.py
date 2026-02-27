"""Gateway MCP Client for CleverTap tools via AgentCore Gateway."""

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

GATEWAY_URL = os.environ["GATEWAY_URL"]
REGION = os.environ.get("AWS_REGION", "us-east-1")


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


def get_gateway_mcp_client() -> MCPClient:
    """Returns an MCP Client that only loads clevertap_* tools from the gateway."""
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    return MCPClient(
        lambda: streamablehttp_client(
            GATEWAY_URL,
            auth=SigV4HTTPXAuth(credentials, REGION),
            timeout=120,
        ),
        tool_filters={"allowed": [re.compile(r"^clevertap_.*")]},
    )
