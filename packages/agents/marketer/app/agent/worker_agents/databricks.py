import asyncio

from strands import tool

from ..utils.a2a import invoke_a2a_agent


def build_databricks_tool(agent_runtime_arn: str, region: str):
    """Create a tool that delegates Databricks tasks to the remote agent."""

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
        return asyncio.run(invoke_a2a_agent(agent_runtime_arn, region, request))

    return query_databricks
