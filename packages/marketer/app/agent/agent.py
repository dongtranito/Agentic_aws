import os
from contextlib import contextmanager

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from strands import Agent, tool
from strands_tools import current_time

MEMORY_ID = os.environ["MEMORY_ID"]
REGION = os.environ.get("AWS_REGION", "us-east-1")


@tool
def add(a: int, b: int) -> int:
    return a + b


@contextmanager
def get_agent(session_id: str, actor_id: str):
    """Get an agent with AgentCore memory session manager."""
    agentcore_memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=agentcore_memory_config,
        region_name=REGION,
    )

    try:
        yield Agent(
            system_prompt="""
You are an addition wizard.
Use the 'add' tool for addition tasks.
Refer to tools as your 'spellbook'.
""",
            tools=[add, current_time],
            session_manager=session_manager,
        )
    finally:
        session_manager.close()
