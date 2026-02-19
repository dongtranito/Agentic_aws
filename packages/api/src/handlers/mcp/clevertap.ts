/**
 * CleverTap MCP Server Lambda Handler
 * Provides mock data for CleverTap customer engagement operations
 *
 * Gateway passes tool arguments as the event object.
 * Tool name is in context.clientContext.custom.bedrockAgentCoreToolName
 */

interface GatewayClientContext {
  custom?: {
    bedrockAgentCoreToolName?: string;
    bedrockAgentCoreMessageVersion?: string;
    bedrockAgentCoreAwsRequestId?: string;
    bedrockAgentCoreMcpMessageId?: string;
    bedrockAgentCoreGatewayId?: string;
    bedrockAgentCoreTargetId?: string;
  };
}

interface GatewayContext {
  clientContext?: GatewayClientContext;
}

// Mock data for CleverTap
const mockUserProfile = {
  identity: 'user_12345',
  email: 'user@example.com',
  phone: '+1234567890',
  name: 'John Doe',
  properties: {
    plan_type: 'premium',
    signup_date: '2024-06-15',
    last_active: '2026-02-18',
    total_purchases: 8,
    lifetime_value: 1250.0,
  },
  segments: ['active_users', 'premium_customers', 'email_engaged'],
};

const mockCampaignStats = {
  campaign_id: 'ct_camp_001',
  campaign_name: 'Spring Sale 2026',
  channel: 'push',
  status: 'active',
  sent: 50000,
  delivered: 48500,
  opened: 12125,
  clicked: 3640,
  converted: 728,
  delivery_rate: 97.0,
  open_rate: 25.0,
  ctr: 7.5,
  conversion_rate: 1.5,
};

const mockSegments = [
  {
    id: 'ct_seg_001',
    name: 'Active Users',
    count: 125000,
    last_updated: '2026-02-19',
  },
  {
    id: 'ct_seg_002',
    name: 'Churned Users',
    count: 45000,
    last_updated: '2026-02-19',
  },
  {
    id: 'ct_seg_003',
    name: 'High Spenders',
    count: 18000,
    last_updated: '2026-02-19',
  },
  {
    id: 'ct_seg_004',
    name: 'New Users (30d)',
    count: 8500,
    last_updated: '2026-02-19',
  },
];

const mockEventData = {
  event_name: 'Product Viewed',
  count: 45000,
  unique_users: 12500,
  time_range: 'last_7_days',
  top_properties: [
    { property: 'category', value: 'Electronics', count: 15000 },
    { property: 'category', value: 'Clothing', count: 12000 },
    { property: 'category', value: 'Home', count: 8000 },
  ],
};

function extractToolName(fullToolName: string): string {
  // Tool name format: ${target_name}__${tool_name}
  const delimiter = '__';
  const idx = fullToolName.indexOf(delimiter);
  return idx >= 0
    ? fullToolName.substring(idx + delimiter.length)
    : fullToolName;
}

function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): unknown {
  console.log(`Handling tool: ${toolName} with args:`, JSON.stringify(args));

  switch (toolName) {
    case 'clevertap_get_user_profile':
      return {
        status: 'success',
        data: {
          ...mockUserProfile,
          identity: args.user_id || mockUserProfile.identity,
        },
      };

    case 'clevertap_get_campaign_stats':
      return {
        status: 'success',
        data: {
          ...mockCampaignStats,
          campaign_id: args.campaign_id || mockCampaignStats.campaign_id,
        },
      };

    case 'clevertap_list_segments':
      return {
        status: 'success',
        data: {
          segments: mockSegments,
          total_count: mockSegments.length,
        },
      };

    case 'clevertap_get_event_data':
      return {
        status: 'success',
        data: {
          ...mockEventData,
          event_name: args.event_name || mockEventData.event_name,
        },
      };

    case 'clevertap_send_push_notification':
      return {
        status: 'success',
        data: {
          message_id: `msg_${Date.now()}`,
          user_id: args.user_id,
          title: args.title,
          body: args.body,
          scheduled: true,
          estimated_delivery: new Date(Date.now() + 60000).toISOString(),
        },
      };

    case 'clevertap_create_segment':
      return {
        status: 'success',
        data: {
          segment_id: `ct_seg_${Date.now()}`,
          name: args.name,
          criteria: args.criteria,
          estimated_size: Math.floor(Math.random() * 50000) + 1000,
          created_at: new Date().toISOString(),
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

    console.log('CleverTap MCP request:', {
      fullToolName,
      toolName,
      event,
      contextCustom: context.clientContext?.custom,
    });

    // Event contains the tool arguments directly
    const result = handleToolCall(toolName, event);

    return result;
  } catch (err) {
    console.error('CleverTap MCP error:', err);
    return { error: 'Internal server error' };
  }
};
