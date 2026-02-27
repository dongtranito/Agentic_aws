import os

from strands import Agent
from strands_tools import current_time

from .gateway_mcp_client import get_gateway_mcp_client

REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_talonone_agent() -> Agent:
    """Create a TalonOne agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client()

    return Agent(
        name="TalonOne Agent",
        description="A TalonOne promotions agent for campaigns, loyalty programs, coupons, and customer sessions.",
        system_prompt="""\
You are a TalonOne promotions assistant with access to TalonOne tools via the gateway.

You have access to the following TalonOne tools:
- talonone_get_campaign: Get details of a TalonOne promotion campaign
- talonone_list_campaigns: List all TalonOne promotion campaigns
- talonone_get_customer_session: Get a customer shopping session from TalonOne
- talonone_update_customer_session: Update a customer shopping session in TalonOne
- talonone_get_loyalty_program: Get loyalty program details from TalonOne
- talonone_get_customer_loyalty: Get customer loyalty status and points from TalonOne
- talonone_redeem_points: Redeem loyalty points for a customer in TalonOne
- talonone_list_coupons: List all coupons in TalonOne
- talonone_validate_coupon: Validate a coupon code in TalonOne
- talonone_create_coupon: Create a new coupon in TalonOne

Workflow guidelines:
1. When asked about campaigns, use talonone_list_campaigns to discover available campaigns first.
2. For customer sessions, use talonone_get_customer_session before making updates.
3. Check loyalty status with talonone_get_customer_loyalty before redeeming points.
4. Validate coupons with talonone_validate_coupon before applying them.
5. Always explain what you're doing and interpret the results clearly.
""",
        tools=[current_time, mcp_client],
        callback_handler=None,
    )
