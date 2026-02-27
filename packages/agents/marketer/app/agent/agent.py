import os
from contextlib import contextmanager

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from strands import Agent
from strands_tools import current_time

from .hooks import S3ArtifactHook
from .worker_agents import build_clevertap_tool, build_databricks_tool, build_talonone_tool

MEMORY_ID = os.environ["MEMORY_ID"]
REGION = os.environ.get("AWS_REGION", "us-east-1")
DATABRICKS_A2A_ENDPOINT = os.environ["DATABRICKS_A2A_ENDPOINT"]
CLEVERTAP_A2A_ENDPOINT = os.environ["CLEVERTAP_A2A_ENDPOINT"]
TALONONE_A2A_ENDPOINT = os.environ["TALONONE_A2A_ENDPOINT"]


@contextmanager
def get_agent(session_id: str, actor_id: str):
    """Get an agent with AgentCore memory and A2A worker agents."""
    agentcore_memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=agentcore_memory_config,
        region_name=REGION,
    )

    tools = [
        current_time,
        build_databricks_tool(DATABRICKS_A2A_ENDPOINT, REGION),
        build_clevertap_tool(CLEVERTAP_A2A_ENDPOINT, REGION),
        build_talonone_tool(TALONONE_A2A_ENDPOINT, REGION),
    ]

    try:
        agent = Agent(
            system_prompt="""\
You are a marketing assistant that orchestrates specialized worker agents.

You have access to the following worker agents:
- query_databricks: For data analytics, audience segmentation, and SQL queries.
  Delegate all Databricks-related tasks to this tool.
- query_clevertap: For user profiles, campaign stats, segments, events, and push notifications.
  Delegate all CleverTap-related tasks to this tool.
- query_talonone: For promotion campaigns, loyalty programs, coupons, and customer sessions.
  Delegate all TalonOne-related tasks to this tool.

Use the appropriate tools to help users with their marketing tasks.
When using tools, always explain what you're doing and interpret the results.
""",
            tools=tools,
            session_manager=session_manager,
        )

        s3_hook = S3ArtifactHook(session_id=session_id, actor_id=actor_id)
        s3_hook.register(agent.hooks)

        yield agent
    finally:
        session_manager.close()
