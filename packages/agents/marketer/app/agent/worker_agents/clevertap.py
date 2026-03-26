# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_clevertap_tool(agent_runtime_arn: str, region: str, session_id: str):
    """Create a tool that delegates CleverTap tasks to the remote agent."""

    @tool
    async def clevertap_agent(request: str) -> AsyncIterator:
        """Send a marketing request to the CleverTap agent.

        Use this tool for any CleverTap-related tasks including:
        - Getting user profiles and event data
        - Viewing campaign statistics
        - Listing and creating user segments
        - Creating and managing draft campaigns

        Args:
            request: A natural language description of the marketing task.
        """
        async for event in stream_a2a_agent(
            agent_runtime_arn,
            region,
            request,
            session_id,
        ):
            yield event

    return clevertap_agent
