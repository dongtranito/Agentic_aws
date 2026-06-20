// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
/**
 * Databricks MCP Server Lambda Handler
 * Implements real Databricks API calls via SQL Statement Execution,
 * SQL Warehouses, Unity Catalog, and Jobs APIs.
 *
 * Large SQL results are truncated and the full data is uploaded to S3.
 *
 * [VI] Lambda Handler cho MCP Server của Databricks.
 * Hiện thực các lệnh gọi API Databricks thật qua các API: SQL Statement Execution,
 * SQL Warehouses, Unity Catalog và Jobs.
 *
 * Kết quả SQL lớn sẽ bị cắt bớt (truncate) và toàn bộ dữ liệu đầy đủ được tải lên S3.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GatewayContext, extractToolName, getSecret } from './utils/index.js';

const DATABRICKS_SECRET_ARN = process.env.DATABRICKS_SECRET_ARN ?? '';
const SQL_RESULTS_BUCKET = process.env.SQL_RESULTS_BUCKET ?? '';

const MAX_ROWS = 20;
const MAX_RESULT_BYTES = 10_000;

const s3 = new S3Client({});

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

// --- Result truncation ---
// [VI] --- Cắt bớt kết quả ---

interface SqlResult {
  manifest?: { schema?: { columns?: unknown[] } };
  result?: { data_array?: unknown[][] };
  [key: string]: unknown;
}

async function truncateIfNeeded(result: unknown): Promise<unknown> {
  const sqlResult = result as SqlResult;
  const rows = sqlResult?.result?.data_array;

  if (!rows || rows.length === 0) return result;

  const fullJson = JSON.stringify(result);
  const needsTruncation =
    rows.length > MAX_ROWS || fullJson.length > MAX_RESULT_BYTES;

  if (!needsTruncation) return result;

  // Upload full result to S3
  // [VI] Tải toàn bộ kết quả đầy đủ lên S3
  const key = `results/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: SQL_RESULTS_BUCKET,
      Key: key,
      Body: fullJson,
      ContentType: 'application/json',
    }),
  );

  const s3Uri = `s3://${SQL_RESULTS_BUCKET}/${key}`;
  // [VI] Ghi log: kết quả đã cắt bớt được tải lên S3 (kèm số dòng và số byte)
  console.log(
    `Truncated result uploaded to ${s3Uri} (${rows.length} rows, ${fullJson.length} bytes)`,
  );

  // Return truncated preview
  // [VI] Trả về bản xem trước đã cắt bớt
  return {
    ...sqlResult,
    result: {
      ...sqlResult.result,
      data_array: rows.slice(0, MAX_ROWS),
    },
    _truncated: {
      total_rows: rows.length,
      preview_rows: Math.min(rows.length, MAX_ROWS),
      full_result_s3_uri: s3Uri,
      full_result_bytes: fullJson.length,
    },
  };
}

// --- SQL Statement Execution API ---
// [VI] --- API thực thi câu lệnh SQL ---

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

  const result = await databricksApi('POST', '/api/2.0/sql/statements', body);
  return truncateIfNeeded(result);
}

async function getStatementResult(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { statement_id } = args;
  const result = await databricksApi(
    'GET',
    `/api/2.0/sql/statements/${statement_id}`,
  );
  return truncateIfNeeded(result);
}

// --- SQL Warehouses API ---
// [VI] --- API quản lý SQL Warehouse ---

async function listWarehouses(): Promise<unknown> {
  return databricksApi('GET', '/api/2.0/sql/warehouses');
}

// --- Unity Catalog APIs ---
// [VI] --- Các API của Unity Catalog ---

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
// [VI] --- API quản lý Job ---

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
// [VI] --- Bảng đăng ký công cụ (tool registry) ---

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  execute_sql: executeSql,
  get_statement_result: getStatementResult,
  list_warehouses: () => listWarehouses(),
  list_schemas: listSchemas,
  list_tables: listTables,
  get_table: getTable,
  run_job: runJob,
  get_job_run: getJobRun,
};

export const handler = async (
  event: Record<string, unknown>,
  context: GatewayContext,
): Promise<unknown> => {
  try {
    const fullToolName =
      context.clientContext?.custom?.bedrockAgentCoreToolName || '';
    const toolName = extractToolName(fullToolName);

    // [VI] Ghi log yêu cầu MCP của Databricks (tên công cụ đầy đủ, tên công cụ, sự kiện)
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
    // [VI] Ghi log lỗi MCP của Databricks
    console.error('Databricks MCP error:', err);
    return {
      error: err instanceof Error ? err.message : 'Internal server error',
    };
  }
};
