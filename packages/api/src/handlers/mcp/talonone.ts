/**
 * TalonOne MCP Server Lambda Handler
 * Calls TalonOne Management API and Integration API. Credentials from Secrets Manager.
 */

import { GatewayContext, extractToolName, getSecret } from './utils/index.js';

// ---------------------------------------------------------------------------
// TalonOne credentials & API clients
// ---------------------------------------------------------------------------

const TALONONE_SECRET_ARN = process.env.TALONONE_SECRET_ARN ?? '';

interface TalonOneCredentials {
  baseUrl: string;
  applicationId: number;
  managementKey: string;
  integrationKey: string;
}

async function managementApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const creds = await getSecret<TalonOneCredentials>(TALONONE_SECRET_ARN);
  const baseUrl = creds.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `ManagementKey-v1 ${creds.managementKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  console.log('TalonOne Management API:', { method, url });
  const resp = await fetch(url, init);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TalonOne Management API (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function integrationApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const creds = await getSecret<TalonOneCredentials>(TALONONE_SECRET_ARN);
  const baseUrl = creds.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `ApiKey-v1 ${creds.integrationKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  console.log('TalonOne Integration API:', { method, url });
  const resp = await fetch(url, init);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TalonOne Integration API (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function getAppId(): Promise<number> {
  return (await getSecret<TalonOneCredentials>(TALONONE_SECRET_ARN))
    .applicationId;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listCampaigns(args: Record<string, unknown>): Promise<unknown> {
  const appId = await getAppId();
  const p = new URLSearchParams();
  if (args.state) p.set('campaignState', String(args.state));
  if (args.page_size) p.set('pageSize', String(args.page_size));
  if (args.skip) p.set('skip', String(args.skip));
  const qs = p.toString() ? `?${p.toString()}` : '';
  return managementApi('GET', `/v1/applications/${appId}/campaigns${qs}`);
}

async function getCampaign(args: Record<string, unknown>): Promise<unknown> {
  if (!args.campaign_id) return { error: 'campaign_id is required' };
  const appId = await getAppId();
  return managementApi(
    'GET',
    `/v1/applications/${appId}/campaigns/${args.campaign_id}`,
  );
}

async function getCustomerSession(
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!args.customer_id) return { error: 'customer_id is required' };
  const appId = await getAppId();
  const profile = encodeURIComponent(String(args.customer_id));
  return managementApi(
    'GET',
    `/v1/applications/${appId}/sessions?profile=${profile}&pageSize=1`,
  );
}

async function updateCustomerSession(
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!args.session_id) return { error: 'session_id is required' };
  const body: Record<string, unknown> = {};
  if (args.customer_id) body.profileId = args.customer_id;
  if (args.cart_items) body.cartItems = args.cart_items;
  if (args.state) body.state = args.state;
  return integrationApi(
    'PUT',
    `/v2/customer_sessions/${args.session_id}`,
    body,
  );
}

async function getLoyaltyProgram(
  args: Record<string, unknown>,
): Promise<unknown> {
  if (args.program_id) {
    return managementApi('GET', `/v1/loyalty_programs/${args.program_id}`);
  }
  return managementApi('GET', '/v1/loyalty_programs');
}

async function getCustomerLoyalty(
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!args.customer_id) return { error: 'customer_id is required' };
  if (!args.program_id) return { error: 'program_id is required' };
  const profile = encodeURIComponent(String(args.customer_id));
  return managementApi(
    'GET',
    `/v1/loyalty_programs/${args.program_id}/profile/${profile}/ledger_balances`,
  );
}

async function redeemPoints(args: Record<string, unknown>): Promise<unknown> {
  if (!args.customer_id) return { error: 'customer_id is required' };
  if (!args.program_id) return { error: 'program_id is required' };
  if (!args.points) return { error: 'points is required' };
  const profile = encodeURIComponent(String(args.customer_id));
  const reason = args.reward_id
    ? `Redeem reward: ${args.reward_id}`
    : 'Points redemption';
  return managementApi(
    'PUT',
    `/v1/loyalty_programs/${args.program_id}/profile/${profile}/balance`,
    { points: -(args.points as number), reason },
  );
}

async function listCoupons(args: Record<string, unknown>): Promise<unknown> {
  if (!args.campaign_id) return { error: 'campaign_id is required' };
  const appId = await getAppId();
  const p = new URLSearchParams();
  if (args.page_size) p.set('pageSize', String(args.page_size));
  if (args.skip) p.set('skip', String(args.skip));
  const qs = p.toString() ? `?${p.toString()}` : '';
  return managementApi(
    'GET',
    `/v1/applications/${appId}/campaigns/${args.campaign_id}/coupons${qs}`,
  );
}

async function validateCoupon(args: Record<string, unknown>): Promise<unknown> {
  if (!args.coupon_code) return { error: 'coupon_code is required' };
  const appId = await getAppId();
  const code = encodeURIComponent(String(args.coupon_code));
  return managementApi(
    'GET',
    `/v1/applications/${appId}/coupons/search?value=${code}`,
  );
}

async function createCampaign(args: Record<string, unknown>): Promise<unknown> {
  if (!args.name) return { error: 'name is required' };
  const appId = await getAppId();
  const body: Record<string, unknown> = {
    name: args.name,
    state: args.state ?? 'disabled',
    startTime: args.start_time ?? new Date().toISOString(),
    endTime: args.end_time,
    tags: args.tags ?? [],
    features: args.features ?? [],
  };
  if (args.description) body.description = args.description;
  if (args.attributes) body.attributes = args.attributes;
  return managementApi('POST', `/v1/applications/${appId}/campaigns`, body);
}

async function createCoupon(args: Record<string, unknown>): Promise<unknown> {
  if (!args.campaign_id) return { error: 'campaign_id is required' };
  const appId = await getAppId();
  const body: Record<string, unknown> = {
    usageLimit: args.max_uses ?? 1000,
    numberOfCoupons: 1,
    attributes: {
      discount_type: args.discount_type ?? 'percentage',
      discount_value: args.value ?? 0,
    },
  };
  if (args.code) body.couponPattern = args.code;
  if (args.expires) body.expiryDate = args.expires;
  return managementApi(
    'POST',
    `/v1/applications/${appId}/campaigns/${args.campaign_id}/coupons`,
    body,
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  get_campaign: getCampaign,
  list_campaigns: listCampaigns,
  create_campaign: createCampaign,
  get_customer_session: getCustomerSession,
  update_customer_session: updateCustomerSession,
  get_loyalty_program: getLoyaltyProgram,
  get_customer_loyalty: getCustomerLoyalty,
  redeem_points: redeemPoints,
  list_coupons: listCoupons,
  validate_coupon: validateCoupon,
  create_coupon: createCoupon,
};

export const handler = async (
  event: Record<string, unknown>,
  context: GatewayContext,
): Promise<unknown> => {
  try {
    const fullToolName =
      context.clientContext?.custom?.bedrockAgentCoreToolName || '';
    const toolName = extractToolName(fullToolName);

    console.log('TalonOne MCP request:', { fullToolName, toolName, event });

    const toolHandler = toolRegistry[toolName];
    if (!toolHandler) {
      return { error: `Unknown tool: ${toolName}` };
    }

    return await toolHandler(event);
  } catch (err) {
    console.error('TalonOne MCP error:', err);
    return {
      error: err instanceof Error ? err.message : 'Internal server error',
    };
  }
};
