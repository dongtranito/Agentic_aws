import os
from contextlib import contextmanager, suppress

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from strands import Agent, tool
from strands_tools import current_time

from .gateway_mcp_client import get_gateway_mcp_client
from .hooks import S3ArtifactHook

MEMORY_ID = os.environ["MEMORY_ID"]
REGION = os.environ.get("AWS_REGION", "us-east-1")


@tool
def add(a: int, b: int) -> int:
    return a + b


@contextmanager
def get_agent(session_id: str, actor_id: str):
    """Get an agent with AgentCore memory session manager and gateway tools."""
    agentcore_memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=agentcore_memory_config,
        region_name=REGION,
    )

    # Base tools
    tools = [add, current_time]

    # Get gateway tools
    mcp_client = get_gateway_mcp_client()
    mcp_client.__enter__()
    gateway_tools = mcp_client.list_tools_sync()
    tools.extend(gateway_tools)
    print(f"Loaded {len(gateway_tools)} tools from gateway")

    try:
        agent = Agent(
            system_prompt="""
You are a marketing assistant with access to various marketing tools.

You have access to the following tool categories:
- Databricks: For data analytics, audience segmentation, and SQL queries
- CleverTap: For customer engagement, push notifications, and user profiles
- TalonOne: For loyalty programs, promotions, and coupon management

Use the appropriate tools to help users with their marketing tasks.
When using tools, always explain what you're doing and interpret the results.
""",
            tools=tools,
            session_manager=session_manager,
        )

        # Register S3 artifact hook
        s3_hook = S3ArtifactHook(session_id=session_id, actor_id=actor_id)
        s3_hook.register(agent.hooks)

        yield agent
    finally:
        with suppress(Exception):
            mcp_client.__exit__(None, None, None)
        session_manager.close()
