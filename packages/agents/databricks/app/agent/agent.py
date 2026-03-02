import os

from common.gateway import get_gateway_mcp_client
from strands import Agent
from strands.session import S3SessionManager
from strands_tools import current_time

REGION = os.environ.get("AWS_REGION", "us-east-1")
ARTIFACT_BUCKET = os.environ["ARTIFACT_BUCKET"]


def get_databricks_agent() -> Agent:
    """Create a Databricks agent with gateway tools for A2A serving."""
    mcp_client = get_gateway_mcp_client("databricks-target")

    session_manager = S3SessionManager(
        session_id="databricks-agent",
        bucket=ARTIFACT_BUCKET,
        region_name=REGION,
    )

    return Agent(
        name="Databricks Agent",
        description="A Databricks data analytics agent for SQL queries, data discovery, and job management.",
        system_prompt="""
You are a Databricks data analytics assistant with access to Databricks tools via the gateway.

You have access to the following tools:
- execute_sql: Execute SQL queries against a Databricks SQL warehouse
- get_statement_result: Poll for results of long-running SQL statements
- list_warehouses: List available SQL warehouses to discover warehouse IDs
- list_schemas: List schemas in a Unity Catalog catalog for data discovery
- list_tables: List tables in a Unity Catalog schema for data discovery
- get_table: Get table details including column names and types
- run_job: Trigger a Databricks job run for ETL pipelines or scheduled tasks
- get_job_run: Check the status of a Databricks job run

Workflow guidelines:
1. When a user asks to query data, first use list_warehouses to find
   an available warehouse if no warehouse ID is provided.
2. Use list_schemas and list_tables to discover data before writing queries.
3. Use get_table to understand column names and types before constructing SQL.
4. For SQL queries, use execute_sql. If the result is PENDING or RUNNING,
   poll with get_statement_result.
5. If results are truncated, inform the user about the S3 location of the full result set.
6. Always explain what you're doing and interpret the results clearly.
""",
        tools=[current_time, mcp_client],
        session_manager=session_manager,
        callback_handler=None,
    )
