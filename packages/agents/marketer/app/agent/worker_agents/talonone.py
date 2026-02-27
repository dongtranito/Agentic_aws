import asyncio

from strands import tool

from ..utils.a2a import invoke_a2a_agent


def build_talonone_tool(agent_runtime_arn: str, region: str):
    """Create a tool that delegates TalonOne tasks to the remote agent."""

    @tool
    def query_talonone(request: str) -> str:
        """Send a promotions request to the TalonOne agent.

        Use this tool for any TalonOne-related tasks including:
        - Managing promotion campaigns
        - Customer shopping sessions
        - Loyalty programs and point redemption
        - Coupon creation, listing, and validation

        Args:
            request: A natural language description of the promotions task.
        """
        return asyncio.run(invoke_a2a_agent(agent_runtime_arn, region, request))

    return query_talonone
