/**
 * Databricks MCP Server Lambda Handler
 * Implements real Databricks API calls via SQL Statement Execution,
 * SQL Warehouses, Unity Catalog, and Jobs APIs.
 */

import { GatewayContext, extractToolName, getSecret } from './utils/index.js';

const DATABRICKS_SECRET_ARN = process.env.DATABRICKS_SECRET_ARN ?? '';

interface DatabricksCredentials {
  url: string;
  token: string;
}

async function databricksApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { url, token } = await getSecret<DatabricksCredentials>(
    DATABRICKS_SECRET_ARN,
  );
  const baseUrl = url.replace(/\/$/, '');

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Databricks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// --- SQL Statement Execution API ---

async function executeSql(args: Record<string, unknown>): Promise<unknown> {
  const { query, warehouse_id, catalog, schema, row_limit, wait_timeout } =
    args;

  const body: Record<string, unknown> = {
    statement: query,
    warehouse_id,
  };
  if (catalog) body.catalog = catalog;
  if (schema) body.schema = schema;
  if (row_limit) body.row_limit = row_limit;
  if (wait_timeout) body.wait_timeout = wait_timeout;

  return databricksApi('POST', '/api/2.0/sql/statements', body);
}

async function getStatementResult(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { statement_id } = args;
  return databricksApi('GET', `/api/2.0/sql/statements/${statement_id}`);
}

// --- SQL Warehouses API ---

async function listWarehouses(): Promise<unknown> {
  return databricksApi('GET', '/api/2.0/sql/warehouses');
}

// --- Unity Catalog APIs ---

async function listSchemas(args: Record<string, unknown>): Promise<unknown> {
  const { catalog_name } = args;
  return databricksApi(
    'GET',
    `/api/2.1/unity-catalog/schemas?catalog_name=${encodeURIComponent(catalog_name as string)}`,
  );
}

async function listTables(args: Record<string, unknown>): Promise<unknown> {
  const { catalog_name, schema_name } = args;
  return databricksApi(
    'GET',
    `/api/2.1/unity-catalog/tables?catalog_name=${encodeURIComponent(catalog_name as string)}&schema_name=${encodeURIComponent(schema_name as string)}`,
  );
}

async function getTable(args: Record<string, unknown>): Promise<unknown> {
  const { full_name } = args;
  return databricksApi(
    'GET',
    `/api/2.1/unity-catalog/tables/${encodeURIComponent(full_name as string)}`,
  );
}

// --- Jobs API ---

async function runJob(args: Record<string, unknown>): Promise<unknown> {
  const { job_id, notebook_params, jar_params, python_params } = args;

  const body: Record<string, unknown> = { job_id };
  if (notebook_params) body.notebook_params = notebook_params;
  if (jar_params) body.jar_params = jar_params;
  if (python_params) body.python_params = python_params;

  return databricksApi('POST', '/api/2.1/jobs/run-now', body);
}

async function getJobRun(args: Record<string, unknown>): Promise<unknown> {
  const { run_id } = args;
  return databricksApi('GET', `/api/2.1/jobs/runs/get?run_id=${run_id}`);
}

// --- Tool registry ---

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  databricks_execute_sql: executeSql,
  databricks_get_statement_result: getStatementResult,
  databricks_list_warehouses: () => listWarehouses(),
  databricks_list_schemas: listSchemas,
  databricks_list_tables: listTables,
  databricks_get_table: getTable,
  databricks_run_job: runJob,
  databricks_get_job_run: getJobRun,
};

export const handler = async (
  event: Record<string, unknown>,
  context: GatewayContext,
): Promise<unknown> => {
  try {
    const fullToolName =
      context.clientContext?.custom?.bedrockAgentCoreToolName || '';
    const toolName = extractToolName(fullToolName);

    console.log('Databricks MCP request:', {
      fullToolName,
      toolName,
      event,
    });

    const toolHandler = toolRegistry[toolName];
    if (!toolHandler) {
      return { error: `Unknown tool: ${toolName}` };
    }

    return await toolHandler(event);
  } catch (err) {
    console.error('Databricks MCP error:', err);
    return {
      error: err instanceof Error ? err.message : 'Internal server error',
    };
  }
};
