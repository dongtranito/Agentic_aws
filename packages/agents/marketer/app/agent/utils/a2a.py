# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
"""A2A utility helpers for AgentCore runtimes.

Uses the Strands A2AAgent class for protocol communication, with
custom SigV4 auth and boto3-based agent card discovery for
AgentCore Runtime endpoints.

Reference: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/agent-to-agent

[VI] Các hàm tiện ích A2A (Agent-to-Agent) cho các runtime AgentCore.

Sử dụng lớp A2AAgent của Strands để giao tiếp theo giao thức, kèm
xác thực SigV4 tùy chỉnh và tra cứu agent card dựa trên boto3 cho
các endpoint AgentCore Runtime.

Tham khảo: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/agent-to-agent
"""

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from urllib.parse import quote

import boto3
import httpx
from a2a.client import ClientConfig, ClientFactory
from a2a.types import AgentCard
from strands.agent.a2a_agent import A2AAgent

from .sigv4_auth import SigV4HTTPXAuth

logger = logging.getLogger(__name__)


@dataclass
class SubAgentProgress:
    """Intermediate progress event from a subagent.

    [VI] Sự kiện báo tiến độ trung gian từ một subagent.
    """

    agent_name: str
    content: str


def _build_endpoint_url(agent_runtime_arn: str, region: str) -> str:
    """Build the AgentCore Runtime invocation URL from an ARN.

    [VI] Tạo URL gọi AgentCore Runtime từ một ARN.
    """
    encoded_arn = quote(agent_runtime_arn, safe="")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations/"


def _get_agent_card(
    agent_runtime_arn: str,
    region: str,
) -> AgentCard:
    """Fetch agent card via boto3 SDK.

    [VI] Lấy agent card (thẻ mô tả agent) thông qua boto3 SDK.
    """
    client = boto3.client("bedrock-agentcore", region_name=region)
    response = client.get_agent_card(agentRuntimeArn=agent_runtime_arn)
    card_dict = response.get("agentCard", {})
    if not card_dict:
        raise ValueError(f"No agent card found for {agent_runtime_arn}")
    return AgentCard(**card_dict)


def _build_client_factory(
    region: str,
    session_id: str,
) -> ClientFactory:
    """Build an A2A ClientFactory with SigV4 auth.

    [VI] Tạo một ClientFactory A2A với xác thực SigV4.
    """
    session = boto3.Session()
    credentials = session.get_credentials()
    auth = SigV4HTTPXAuth(credentials, region)

    headers = {
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session_id,
    }

    httpx_client = httpx.AsyncClient(
        timeout=300,
        auth=auth,
        headers=headers,
    )

    config = ClientConfig(httpx_client=httpx_client, streaming=True)
    return ClientFactory(config)


def build_a2a_agent(
    agent_runtime_arn: str,
    region: str,
    session_id: str,
) -> A2AAgent:
    """Build a Strands A2AAgent for an AgentCore Runtime endpoint.

    [VI] Tạo một A2AAgent của Strands cho một endpoint AgentCore Runtime.
    """
    endpoint_url = _build_endpoint_url(agent_runtime_arn, region)
    # [VI] Ghi log thông tin tạo agent A2A kèm session_id và ARN
    logger.info(f"Building A2A agent with session_id={session_id} for {agent_runtime_arn}")
    client_factory = _build_client_factory(region, session_id)
    agent_card = _get_agent_card(agent_runtime_arn, region)

    a2a_agent = A2AAgent(
        endpoint=endpoint_url,
        name=agent_card.name,
        description=agent_card.description,
        a2a_client_factory=client_factory,
        timeout=300,
    )

    # Pre-populate cached agent card to skip HTTP-based card resolution.
    # [VI] Nạp sẵn agent card vào bộ nhớ đệm để bỏ qua bước tra cứu card qua HTTP.
    a2a_agent._agent_card = agent_card

    return a2a_agent


def _extract_text_from_event(event: dict) -> str | None:
    """Extract text content from an A2A stream event.

    A2A stream events have type='a2a_stream' with an 'event' key
    containing a tuple of (Task, UpdateEvent). The UpdateEvent can be
    a TaskArtifactUpdateEvent (with artifact.parts containing text)
    or a TaskStatusUpdateEvent (with status.message.parts).

    [VI] Trích xuất nội dung văn bản từ một sự kiện stream A2A.

    Các sự kiện stream A2A có type='a2a_stream' với khóa 'event' chứa
    một tuple gồm (Task, UpdateEvent). UpdateEvent có thể là
    TaskArtifactUpdateEvent (với artifact.parts chứa văn bản)
    hoặc TaskStatusUpdateEvent (với status.message.parts).
    """
    # Final result event from Strands
    # [VI] Sự kiện kết quả cuối cùng từ Strands
    if "result" in event:
        content = event["result"].message.get("content", [])
        texts = [part["text"] for part in content if "text" in part]
        if texts:
            return "\n".join(texts)

    # A2A stream events: tuple of (Task, UpdateEvent)
    # [VI] Sự kiện stream A2A: tuple gồm (Task, UpdateEvent)
    a2a_event = event.get("event")
    if not isinstance(a2a_event, tuple) or len(a2a_event) < 2:
        return None

    update = a2a_event[1]
    if update is None:
        return None

    # Try TaskArtifactUpdateEvent — has artifact.parts
    # [VI] Thử với TaskArtifactUpdateEvent — có artifact.parts
    artifact = getattr(update, "artifact", None)
    if artifact is not None:
        parts = getattr(artifact, "parts", None)
        if parts:
            texts = []
            for part in parts:
                # Part wraps the actual content in .root
                # [VI] Part bọc nội dung thực tế bên trong thuộc tính .root
                root = getattr(part, "root", part)
                text = getattr(root, "text", None)
                if text:
                    texts.append(text)
            if texts:
                return "".join(texts)

    # Try TaskStatusUpdateEvent — has status.message.parts
    # [VI] Thử với TaskStatusUpdateEvent — có status.message.parts
    status = getattr(update, "status", None)
    if status is not None:
        message = getattr(status, "message", None)
        if message is not None:
            parts = getattr(message, "parts", None)
            if parts:
                texts = []
                for part in parts:
                    root = getattr(part, "root", part)
                    text = getattr(root, "text", None)
                    if text:
                        texts.append(text)
                if texts:
                    return "".join(texts)

    return None


async def stream_a2a_agent(
    agent_runtime_arn: str,
    region: str,
    prompt: str,
    session_id: str,
) -> "AsyncIterator":
    """Async generator that streams progress from a remote A2A agent.

    Yields SubAgentProgress for intermediate updates, then yields
    the final response string as the last item.

    [VI] Generator bất đồng bộ phát ra (stream) tiến độ từ một agent A2A từ xa.

    Phát ra SubAgentProgress cho các cập nhật trung gian, rồi cuối cùng
    phát ra chuỗi phản hồi cuối cùng làm phần tử cuối.
    """
    a2a_agent = build_a2a_agent(agent_runtime_arn, region, session_id)
    agent_name = a2a_agent.name or "subagent"
    final_text = ""

    async for event in a2a_agent.stream_async(prompt):
        text = _extract_text_from_event(event)
        if text:
            final_text = text
            yield SubAgentProgress(
                agent_name=agent_name,
                content=text,
            )

    # Final yield must be a string — this becomes the tool result
    # [VI] Giá trị yield cuối cùng phải là một chuỗi — đây sẽ trở thành kết quả của công cụ
    yield final_text or "Task completed successfully"
