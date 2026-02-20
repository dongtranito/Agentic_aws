/**
 * Databricks MCP Server Lambda Handler
 * Provides mock data for Databricks operations
 */

import { GatewayContext, extractToolName } from './utils/index.js';

// Mock data for Databricks
const mockCampaignPerformance = {
  campaign_id: 'camp_001',
  impressions: 125000,
  clicks: 4500,
  conversions: 320,
  spend: 2500.0,
  ctr: 3.6,
  conversion_rate: 7.1,
  roas: 4.2,
};

const mockAudienceSegments = [
  {
    segment_id: 'seg_001',
    name: 'High Value Customers',
    size: 15000,
    avg_ltv: 450,
  },
  {
    segment_id: 'seg_002',
    name: 'Recent Purchasers',
    size: 8500,
    avg_ltv: 280,
  },
  { segment_id: 'seg_003', name: 'Cart Abandoners', size: 12000, avg_ltv: 150 },
  {
    segment_id: 'seg_004',
    name: 'Newsletter Subscribers',
    size: 45000,
    avg_ltv: 120,
  },
];

const mockSqlQueryResult = {
  columns: ['date', 'channel', 'revenue', 'orders'],
  rows: [
    ['2026-02-15', 'email', 12500, 85],
    ['2026-02-15', 'social', 8200, 62],
    ['2026-02-15', 'search', 15800, 110],
    ['2026-02-16', 'email', 11200, 78],
    ['2026-02-16', 'social', 9100, 71],
    ['2026-02-16', 'search', 14500, 98],
  ],
};

function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): unknown {
  console.log(`Handling tool: ${toolName} with args:`, JSON.stringify(args));

  switch (toolName) {
    case 'databricks_get_campaign_performance':
      return {
        status: 'success',
        data: {
          ...mockCampaignPerformance,
          campaign_id: args.campaign_id || mockCampaignPerformance.campaign_id,
        },
      };

    case 'databricks_list_audience_segments':
      return {
        status: 'success',
        data: {
          segments: mockAudienceSegments,
          total_count: mockAudienceSegments.length,
        },
      };

    case 'databricks_run_sql_query':
      return {
        status: 'success',
        data: {
          query: args.query,
          result: mockSqlQueryResult,
          execution_time_ms: 245,
        },
      };

    case 'databricks_get_customer_insights':
      return {
        status: 'success',
        data: {
          customer_id: args.customer_id || 'cust_12345',
          total_orders: 12,
          total_spend: 1850.0,
          avg_order_value: 154.17,
          first_purchase: '2024-03-15',
          last_purchase: '2026-02-10',
          preferred_channel: 'email',
          segment: 'High Value Customers',
        },
      };

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export const handler = async (
  event: Record<string, unknown>,
  context: GatewayContext,
): Promise<unknown> => {
  try {
    // Get tool name from context
    const fullToolName =
      context.clientContext?.custom?.bedrockAgentCoreToolName || '';
    const toolName = extractToolName(fullToolName);

    console.log('Databricks MCP request:', {
      fullToolName,
      toolName,
      event,
      contextCustom: context.clientContext?.custom,
    });

    // Event contains the tool arguments directly
    const result = handleToolCall(toolName, event);

    return result;
  } catch (err) {
    console.error('Databricks MCP error:', err);
    return { error: 'Internal server error' };
  }
};
