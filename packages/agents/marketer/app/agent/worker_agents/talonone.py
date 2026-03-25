from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_talonone_tool(agent_runtime_arn: str, region: str, session_id: str):
    """Create a tool that delegates TalonOne tasks to the remote agent."""

    @tool
    async def talonone_agent(request: str) -> AsyncIterator:
        """Send a promotions request to the TalonOne agent.

        Use this tool for any TalonOne-related tasks including:
        - Managing promotion campaigns
        - Customer shopping sessions
        - Loyalty programs and point redemption
        - Coupon creation, listing, and validation

        Args:
            request: A natural language description of the promotions task.
        """
        async for event in stream_a2a_agent(
            agent_runtime_arn,
            region,
            request,
            session_id,
        ):
            yield event

    return talonone_agent
