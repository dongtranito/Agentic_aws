from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_clevertap_tool(agent_runtime_arn: str, region: str):
    """Create a tool that delegates CleverTap tasks to the remote agent."""

    @tool
    async def query_clevertap(request: str) -> AsyncIterator:
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
        ):
            yield event

    return query_clevertap
