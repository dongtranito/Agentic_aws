import asyncio

from strands import tool

from ..utils.a2a import invoke_a2a_agent


def build_clevertap_tool(agent_runtime_arn: str, region: str):
    """Create a tool that delegates CleverTap tasks to the remote agent."""

    @tool
    def query_clevertap(request: str) -> str:
        """Send a marketing request to the CleverTap agent.

        Use this tool for any CleverTap-related tasks including:
        - Getting user profiles and event data
        - Viewing campaign statistics
        - Listing and creating user segments
        - Sending push notifications

        Args:
            request: A natural language description of the marketing task.
        """
        return asyncio.run(invoke_a2a_agent(agent_runtime_arn, region, request))

    return query_clevertap
