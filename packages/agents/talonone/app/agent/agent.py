import os

from common.gateway import get_gateway_mcp_client
from strands import Agent
from strands_tools import current_time

REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_talonone_agent() -> Agent:
    """Create a TalonOne agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client("talonone-target")

    return Agent(
        name="TalonOne Agent",
        description="A TalonOne promotions agent for campaigns, loyalty programs, coupons, and customer sessions.",
        system_prompt="""\
You are a TalonOne promotions assistant with access to TalonOne tools via the gateway.

You have access to the following tools:
- get_campaign: Get details of a promotion campaign
- list_campaigns: List all promotion campaigns
- get_customer_session: Get a customer shopping session
- update_customer_session: Update a customer shopping session
- get_loyalty_program: Get loyalty program details
- get_customer_loyalty: Get customer loyalty status and points
- redeem_points: Redeem loyalty points for a customer
- list_coupons: List all coupons
- validate_coupon: Validate a coupon code
- create_coupon: Create a new coupon

Workflow guidelines:
1. When asked about campaigns, use list_campaigns to discover available campaigns first.
2. For customer sessions, use get_customer_session before making updates.
3. Check loyalty status with get_customer_loyalty before redeeming points.
4. Validate coupons with validate_coupon before applying them.
5. Always explain what you're doing and interpret the results clearly.
""",
        tools=[current_time, mcp_client],
        callback_handler=None,
    )
