# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_databricks_tool(agent_runtime_arn: str, region: str, session_id: str):
    """Create a tool that delegates Databricks tasks to the remote agent."""

    @tool
    async def databricks_agent(request: str) -> AsyncIterator:
        """Send a data analytics request to the Databricks agent.

        Use this tool for any Databricks-related tasks including:
        - Executing SQL queries against Databricks warehouses
        - Discovering schemas, tables, and columns in Unity Catalog
        - Running and monitoring Databricks jobs
        - Audience segmentation and data analysis

        Args:
            request: A natural language description of the data task.
        """
        async for event in stream_a2a_agent(
            agent_runtime_arn,
            region,
            request,
            session_id,
        ):
            yield event

    return databricks_agent
