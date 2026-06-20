// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
/**
 * CleverTap MCP Server Lambda Handler
 * All tools call CleverTap APIs directly. Credentials from Secrets Manager.
 *
 * [VI] Lambda Handler cho MCP Server của CleverTap.
 * Tất cả các công cụ gọi trực tiếp các API của CleverTap. Thông tin xác thực lấy từ Secrets Manager.
 */

import { GatewayContext, extractToolName, getSecret } from './utils/index.js';

// ---------------------------------------------------------------------------
// CleverTap credentials & API client
// [VI] Thông tin xác thực CleverTap & client gọi API
// ---------------------------------------------------------------------------

const CLEVERTAP_SECRET_ARN = process.env.CLEVERTAP_SECRET_ARN ?? '';

interface ClevertapCredentials {
  projectId: string;
  passcode: string;
  region: string;
}

function getBaseUrl(region: string): string {
  return region
    ? `https://${region}.api.clevertap.com`
    : 'https://api.clevertap.com';
}

async function ctFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const creds = await getSecret<ClevertapCredentials>(CLEVERTAP_SECRET_ARN);
  const url = `${getBaseUrl(creds.region)}${path}`;

  // [VI] Ghi log yêu cầu gửi tới API CleverTap (URL và nội dung body)
  console.log('CleverTap API request:', { url, body });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-CleverTap-Account-Id': creds.projectId,
      'X-CleverTap-Passcode': creds.passcode,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await resp.json();
  // [VI] Ghi log phản hồi từ API CleverTap (mã trạng thái và nội dung body)
  console.log('CleverTap API response:', {
    status: resp.status,
    body: JSON.stringify(result),
  });

  return result;
}

// ---------------------------------------------------------------------------
// Tool implementations — all CleverTap API calls
// [VI] Phần hiện thực các công cụ — tất cả đều là lệnh gọi API CleverTap
// ---------------------------------------------------------------------------

interface ProfileFilter {
  name: string;
  operator: string;
  value: unknown;
}

/**
 * Builds a CQL where clause from user_property_filters.
 * Each filter is { name, operator, value } targeting a CleverTap profile field.
 *
 * [VI] Tạo mệnh đề where (CQL) từ user_property_filters.
 * Mỗi bộ lọc có dạng { name, operator, value } nhắm tới một trường hồ sơ (profile) của CleverTap.
 */
function buildWhereClause(
  filters: ProfileFilter[],
  eventFilter?: Record<string, unknown>,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (eventFilter) {
    if (eventFilter.event_name) where.event_name = eventFilter.event_name;
    if (eventFilter.from) where.from = eventFilter.from;
    if (eventFilter.to) where.to = eventFilter.to;
  }

  if (filters.length > 0) {
    where.common_profile_properties = {
      profile_fields: filters.map((f) => ({
        name: f.name,
        operator: f.operator ?? 'equals',
        value: f.value,
      })),
    };
  }

  return where;
}

/**
 * Builds the common campaign payload from tool args.
 * Returns null + error if required fields are missing.
 *
 * [VI] Tạo payload chung cho chiến dịch từ các tham số của công cụ.
 * Trả về lỗi nếu thiếu các trường bắt buộc.
 */
function buildCampaignPayload(
  args: Record<string, unknown>,
  estimateOnly: boolean,
): { payload: Record<string, unknown> } | { error: string } {
  const { name, target_mode, content } = args;
  if (!name || !target_mode || !content) {
    return { error: 'name, target_mode, and content are required' };
  }

  const payload: Record<string, unknown> = {
    name,
    target_mode,
    content,
    estimate_only: estimateOnly,
    respect_frequency_caps: false,
  };

  // Scheduling: build the `when` parameter
  // [VI] Lập lịch: tạo tham số `when`
  const scheduleStart = args.schedule_start as string | undefined;
  const scheduleEnd = args.schedule_end as string | undefined;
  const repeatType = args.repeat_type as string | undefined;
  const repeatEvery = args.repeat_every as number | undefined;
  const repeatOnDays = args.repeat_on_days_of_week as number[] | undefined;

  if (repeatType && scheduleStart) {
    // Recurring campaign
    // [VI] Chiến dịch lặp lại theo chu kỳ
    const whenObj: Record<string, unknown> = {
      type: 'recurring',
      start_time: scheduleStart,
      repeat_type: repeatType,
      repeats_every: repeatEvery ?? 1,
    };
    if (scheduleEnd) whenObj.end_by_date = scheduleEnd;
    if (repeatOnDays) whenObj.repeat_on_days_of_week = repeatOnDays;
    payload.when = whenObj;
  } else if (scheduleStart) {
    // One-time scheduled campaign
    // [VI] Chiến dịch lên lịch chạy một lần
    payload.when = {
      type: 'later',
      delivery_date_time: [scheduleStart],
    };
  } else {
    // Immediate or simple string schedule
    // [VI] Chạy ngay lập tức hoặc lịch dạng chuỗi đơn giản
    payload.when = args.when ?? 'now';
  }

  // Audience targeting
  // [VI] Nhắm mục tiêu đối tượng (audience)
  const filters = args.user_property_filters as ProfileFilter[] | undefined;
  const eventFilter = args.event_filter as Record<string, unknown> | undefined;

  if (filters && filters.length > 0) {
    payload.where = buildWhereClause(filters, eventFilter);
  } else if (args.where) {
    payload.where = args.where;
  } else if (args.segment) {
    payload.segment = args.segment;
  } else {
    payload.where = {};
  }

  if (args.provider_nick_name)
    payload.provider_nick_name = args.provider_nick_name;
  if (args.labels) payload.labels = args.labels;

  // Webhook-specific fields (must be top-level)
  // [VI] Các trường riêng cho webhook (phải nằm ở cấp cao nhất - top-level)
  if (args.webhook_endpoint_name)
    payload.webhook_endpoint_name = args.webhook_endpoint_name;
  if (args.webhook_fields) payload.webhook_fields = args.webhook_fields;
  if (args.webhook_key_value)
    payload.webhook_key_value = args.webhook_key_value;

  return { payload };
}

/** POST /1/targets/create.json with estimate_only=true */
/* [VI] Gọi POST /1/targets/create.json với estimate_only=true (chỉ ước lượng, chưa tạo thật) */
async function createDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = buildCampaignPayload(args, true);
  if ('error' in result) return { status: 'fail', error: result.error };
  return ctFetch('/1/targets/create.json', result.payload);
}

/** POST /1/targets/create.json with estimate_only=false */
/* [VI] Gọi POST /1/targets/create.json với estimate_only=false (tạo chiến dịch thật) */
async function confirmDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = buildCampaignPayload(args, false);
  if ('error' in result) return { status: 'fail', error: result.error };
  return ctFetch('/1/targets/create.json', result.payload);
}

/** POST /1/targets/create.json with estimate_only=true (re-validate) */
/* [VI] Gọi POST /1/targets/create.json với estimate_only=true (xác thực lại) */
async function updateDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  return createDraftCampaign(args);
}

/** POST /1/targets/list.json */
/* [VI] Gọi POST /1/targets/list.json (liệt kê các chiến dịch) */
async function listDraftCampaigns(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { from, to } = args;
  if (!from || !to) {
    return {
      status: 'fail',
      error: 'from and to date (YYYYMMDD) are required',
    };
  }
  return ctFetch('/1/targets/list.json', { from, to });
}

/** POST /1/targets/result.json */
/* [VI] Gọi POST /1/targets/result.json (lấy chi tiết một chiến dịch) */
async function getDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { campaign_id } = args;
  if (!campaign_id) {
    return { status: 'fail', error: 'campaign_id is required' };
  }
  return ctFetch('/1/targets/result.json', { id: campaign_id });
}

/** POST /1/targets/stop.json */
/* [VI] Gọi POST /1/targets/stop.json (hủy/dừng một chiến dịch nháp) */
async function discardDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { campaign_id } = args;
  if (!campaign_id) {
    return { status: 'fail', error: 'campaign_id is required' };
  }
  return ctFetch('/1/targets/stop.json', { id: campaign_id });
}

// ---------------------------------------------------------------------------
// Router
// [VI] Bộ định tuyến (router) — chọn công cụ phù hợp để xử lý yêu cầu
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  create_draft_campaign: createDraftCampaign,
  confirm_draft_campaign: confirmDraftCampaign,
  list_draft_campaigns: listDraftCampaigns,
  get_draft_campaign: getDraftCampaign,
  update_draft_campaign: updateDraftCampaign,
  discard_draft_campaign: discardDraftCampaign,
};

export const handler = async (
  event: Record<string, unknown>,
  context: GatewayContext,
): Promise<unknown> => {
  try {
    const fullToolName =
      context.clientContext?.custom?.bedrockAgentCoreToolName || '';
    const toolName = extractToolName(fullToolName);

    // [VI] Ghi log yêu cầu MCP của CleverTap
    console.log('CleverTap MCP request:', { fullToolName, toolName, event });

    const toolHandler = toolRegistry[toolName];
    if (!toolHandler) {
      return { error: `Unknown tool: ${toolName}` };
    }

    return await toolHandler(event);
  } catch (err) {
    // [VI] Ghi log lỗi MCP của CleverTap
    console.error('CleverTap MCP error:', err);
    return {
      error: err instanceof Error ? err.message : 'Internal server error',
    };
  }
};
