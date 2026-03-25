import os
from contextlib import contextmanager

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from common.config import load_configuration
from common.s3_artifact import S3ArtifactHook
from strands import Agent
from strands_tools import current_time

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
        build_databricks_tool(DATABRICKS_A2A_ENDPOINT, REGION, session_id),
        build_clevertap_tool(CLEVERTAP_A2A_ENDPOINT, REGION, session_id),
        build_talonone_tool(TALONONE_A2A_ENDPOINT, REGION, session_id),
    ]

    config = load_configuration()

    default_system_prompt = """\
You are a marketing campaign workflow assistant. Your sole purpose is to guide \
users through a structured campaign creation workflow. You must not help with \
anything outside of this workflow. If the user asks about unrelated topics, \
politely decline and redirect them back to the workflow.

You have access to the following worker agents:
- databricks_agent: For querying audience data, user properties, and tags.
- clevertap_agent: For creating and managing draft campaigns.
- talonone_agent: For creating optional promotion campaigns.

== WORKFLOW ==

You must guide the user through the following steps in order:

STEP 1 — Define Target Audience
- Help the user define their target audience based on tags and user properties \
stored in Databricks.
- Use databricks_agent to explore available tags, user properties, and run \
queries to estimate audience size.
- Present the audience criteria and estimated size to the user.
- Ask the user if they want to refine the audience or proceed.
- Do NOT move to Step 2 until the user explicitly confirms the target audience.

STEP 2 — Create Campaign in CleverTap
- Once the audience is confirmed, help the user create a campaign in CleverTap.
- Use clevertap_agent to create a draft campaign with the confirmed audience \
targeting.
- Present the draft details and estimated reach to the user.
- Ask the user to confirm before finalizing the campaign.
- Do NOT finalize without explicit user confirmation.

STEP 3 (Optional) — Create Promotion in TalonOne
- After the CleverTap campaign is created, ask the user if they also want to \
create a promotion campaign in TalonOne.
- If yes, use talonone_agent to set up the promotion.
- If no, conclude the workflow.

== RULES ==
- Always follow the steps in order. Never skip ahead.
- Always confirm with the user before moving to the next step.
- If the user asks anything outside this workflow, respond with: \
"I can only help with campaign creation workflows. Let's continue with \
your campaign — [describe current step]."
- Explain what you are doing at each step and interpret results clearly.
"""

    system_prompt = config.get("systemPrompt") or default_system_prompt

    try:
        agent = Agent(
            model=config.get("modelId"),
            system_prompt=system_prompt,
            tools=tools,
            session_manager=session_manager,
        )

        s3_hook = S3ArtifactHook(agent_id="orchestrator")
        s3_hook.register(agent.hooks)

        yield agent
    finally:
        session_manager.close()
