# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import os

from common.config import load_configuration
from common.gateway import get_gateway_mcp_client
from strands import Agent
from strands_tools import current_time

REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_talonone_agent() -> Agent:
    """Create a TalonOne agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client("talonone-target")
    config = load_configuration()

    default_system_prompt = """\
You are a TalonOne promotions assistant with access to TalonOne tools via the gateway.

You have access to the following tools:
- list_campaigns: List promotion campaigns. Optional filters: state, page_size, skip.
- get_campaign: Get details of a campaign by campaign_id.
- create_campaign: Create a new promotion campaign. Requires name. \
Optional: description, state, start_time, end_time, tags, features.
- get_customer_session: Get customer shopping sessions by customer_id (profile integration ID).
- update_customer_session: Update/create a session by session_id. Accepts customer_id, cart_items, state.
- get_loyalty_program: Get loyalty program details. Pass program_id for a specific program, or omit to list all.
- get_customer_loyalty: Get customer loyalty balances. Requires customer_id and program_id.
- redeem_points: Deduct loyalty points. Requires customer_id, program_id, and points. Optional reward_id.
- list_coupons: List coupons for a campaign. Requires campaign_id.
- validate_coupon: Search for a coupon by coupon_code across all campaigns.
- create_coupon: Create a coupon in a campaign. Requires campaign_id, code, discount_type, value.

Workflow guidelines:
1. When asked about campaigns, use list_campaigns to discover available campaigns first.
2. For customer sessions, use get_customer_session before making updates.
3. Check loyalty status with get_customer_loyalty before redeeming points.
4. Validate coupons with validate_coupon before applying them.
5. When creating coupons, you need a campaign_id — use list_campaigns to find one first.
6. When creating a campaign, start with state 'disabled' so it can be reviewed before going live.
7. Always explain what you're doing and interpret the results clearly.
"""

    system_prompt = config.get("systemPrompt") or default_system_prompt

    return Agent(
        name="TalonOne Agent",
        description="A TalonOne promotions agent for campaigns, loyalty programs, coupons, and customer sessions.",
        system_prompt=system_prompt,
        tools=[current_time, mcp_client],
        model=config.get("modelId"),
        callback_handler=None,
    )
