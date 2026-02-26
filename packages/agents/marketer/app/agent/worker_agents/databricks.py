import asyncio

from strands import tool
from strands.agent.a2a_agent import A2AAgent

from ..utils.a2a import build_endpoint_url, build_sigv4_client_factory


def build_databricks_tool(agent_runtime_arn: str, region: str):
    """Create a tool that delegates Databricks tasks to the remote A2A agent."""
    endpoint = build_endpoint_url(agent_runtime_arn, region)
    client_factory = build_sigv4_client_factory(region)

    databricks_agent = A2AAgent(
        endpoint=endpoint,
        name="Databricks Agent",
        description=("Remote Databricks agent for SQL queries, data discovery, and job management."),
        a2a_client_factory=client_factory,
    )

    async def _stream_databricks(request: str) -> str:
        result = None
        async for event in databricks_agent.stream_async(request):
            if "result" in event:
                result = event["result"]
        if result is None:
            raise RuntimeError("No response received from Databricks agent")
        return str(result)

    @tool
    def query_databricks(request: str) -> str:
        """Send a data analytics request to the Databricks agent.

        Use this tool for any Databricks-related tasks including:
        - Executing SQL queries against Databricks warehouses
        - Discovering schemas, tables, and columns in Unity Catalog
        - Running and monitoring Databricks jobs
        - Audience segmentation and data analysis

        Args:
            request: A natural language description of the data task.
        """
        return asyncio.run(_stream_databricks(request))

    return query_databricks
