/**
 * CleverTap MCP Server Lambda Handler
 * All tools call CleverTap APIs directly. Credentials from Secrets Manager.
 */

import { GatewayContext, extractToolName, getSecret } from './utils/index.js';

// ---------------------------------------------------------------------------
// CleverTap credentials & API client
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
  console.log('CleverTap API response:', {
    status: resp.status,
    body: JSON.stringify(result),
  });

  return result;
}

// ---------------------------------------------------------------------------
// Tool implementations — all CleverTap API calls
// ---------------------------------------------------------------------------

interface ProfileFilter {
  name: string;
  operator: string;
  value: unknown;
}

/**
 * Builds a CQL where clause from user_property_filters.
 * Each filter is { name, operator, value } targeting a CleverTap profile field.
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

/** POST /1/targets/create.json with estimate_only=true */
async function createDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { name, target_mode, content } = args;
  if (!name || !target_mode || !content) {
    return {
      status: 'fail',
      error: 'name, target_mode, and content are required',
    };
  }

  const payload: Record<string, unknown> = {
    name,
    target_mode,
    content,
    estimate_only: true,
    when: args.when ?? 'now',
    respect_frequency_caps: false,
  };

  // Build where clause from user_property_filters if provided
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
  if (args.webhook_endpoint_name)
    payload.webhook_endpoint_name = args.webhook_endpoint_name;
  if (args.webhook_fields) payload.webhook_fields = args.webhook_fields;
  if (args.webhook_key_value)
    payload.webhook_key_value = args.webhook_key_value;

  return ctFetch('/1/targets/create.json', payload);
}

/** POST /1/targets/list.json */
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
async function getDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { campaign_id } = args;
  if (!campaign_id) {
    return { status: 'fail', error: 'campaign_id is required' };
  }
  return ctFetch('/1/targets/result.json', { id: campaign_id });
}

/** POST /1/targets/create.json with estimate_only=true (re-validate with updates) */
async function updateDraftCampaign(
  args: Record<string, unknown>,
): Promise<unknown> {
  return createDraftCampaign(args);
}

/** POST /1/targets/stop.json */
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
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  create_draft_campaign: createDraftCampaign,
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

    console.log('CleverTap MCP request:', { fullToolName, toolName, event });

    const toolHandler = toolRegistry[toolName];
    if (!toolHandler) {
      return { error: `Unknown tool: ${toolName}` };
    }

    return await toolHandler(event);
  } catch (err) {
    console.error('CleverTap MCP error:', err);
    return {
      error: err instanceof Error ? err.message : 'Internal server error',
    };
  }
};
