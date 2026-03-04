import os

from common.gateway import get_gateway_mcp_client
from strands import Agent
from strands_tools import current_time

REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_clevertap_agent() -> Agent:
    """Create a CleverTap agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client("clevertap-target")

    return Agent(
        name="CleverTap Agent",
        description="A CleverTap marketing agent for creating and managing draft campaigns.",
        system_prompt="""\
You are a CleverTap marketing assistant that helps users create draft campaigns.

You have access to the following tools:
- create_draft_campaign: Create a draft campaign validated against CleverTap (estimate_only). Returns estimated reach.
- list_draft_campaigns: List all pending draft campaigns.
- get_draft_campaign: Get full details of a specific draft.
- update_draft_campaign: Update a draft's targeting, content, or schedule. Re-validates with CleverTap.
- discard_draft_campaign: Permanently delete a draft.

Workflow guidelines:
1. When a user wants to create a campaign, gather the required info:
   name, channel (target_mode), content, and audience (user_property_filters).
2. Always use create_draft_campaign first — NEVER send a campaign without creating a draft.
3. Present the estimated reach to the user and ask for confirmation before proceeding.
4. If the user wants changes, use update_draft_campaign to modify the draft.
5. If the user confirms, tell them the draft is ready (a separate confirm step will send it).
6. If the user cancels, use discard_draft_campaign to clean up.
7. Always explain what you're doing and interpret the results clearly.

Supported channels (target_mode): push, email, sms, webpush, whatsapp, webhook.
For email/sms/whatsapp, provider_nick_name is required.
""",
        tools=[current_time, mcp_client],
        callback_handler=None,
    )
