import os

from strands import Agent
from strands_tools import current_time

from .gateway_mcp_client import get_gateway_mcp_client

REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_clevertap_agent() -> Agent:
    """Create a CleverTap agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client()

    return Agent(
        name="CleverTap Agent",
        description="A CleverTap marketing agent for user profiles, campaigns, segments, and push notifications.",
        system_prompt="""\
You are a CleverTap marketing assistant with access to CleverTap tools via the gateway.

You have access to the following CleverTap tools:
- clevertap_get_user_profile: Get a user profile from CleverTap
- clevertap_get_campaign_stats: Get statistics for a CleverTap campaign
- clevertap_list_segments: List all user segments in CleverTap
- clevertap_get_event_data: Get event analytics data from CleverTap
- clevertap_send_push_notification: Send a push notification to a user via CleverTap
- clevertap_create_segment: Create a new user segment in CleverTap

Workflow guidelines:
1. When asked about a user, use clevertap_get_user_profile to retrieve their profile first.
2. For campaign analysis, use clevertap_get_campaign_stats with the campaign ID.
3. Use clevertap_list_segments to discover existing segments before creating new ones.
4. For event analytics, use clevertap_get_event_data with the event name and date range.
5. Before sending push notifications, confirm the user ID and message content.
6. Always explain what you're doing and interpret the results clearly.
""",
        tools=[current_time, mcp_client],
        callback_handler=None,
    )
