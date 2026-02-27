/**
 * TalonOne MCP Server Lambda Handler
 * Provides mock data for TalonOne loyalty and promotions operations
 */

import { GatewayContext, extractToolName } from './utils/index.js';

// Mock data for TalonOne
const mockCampaign = {
  id: 'to_camp_001',
  name: 'Summer Loyalty Boost',
  state: 'enabled',
  start_time: '2026-02-01T00:00:00Z',
  end_time: '2026-03-31T23:59:59Z',
  budget: {
    total: 50000,
    spent: 18500,
    remaining: 31500,
  },
  rules: [
    { name: '10% off orders over $100', triggers: 2500 },
    { name: 'Double points weekend', triggers: 8200 },
    { name: 'Free shipping for VIP', triggers: 1200 },
  ],
};

const mockCustomerSession = {
  session_id: 'sess_12345',
  customer_id: 'cust_67890',
  state: 'open',
  cart_items: [
    { sku: 'PROD001', name: 'Premium Widget', quantity: 2, price: 49.99 },
    { sku: 'PROD002', name: 'Deluxe Gadget', quantity: 1, price: 129.99 },
  ],
  subtotal: 229.97,
  applied_effects: [
    { type: 'discount', value: 22.99, rule: '10% off orders over $100' },
    { type: 'points', value: 460, rule: 'Double points weekend' },
  ],
  total: 206.98,
};

const mockLoyaltyProgram = {
  program_id: 'loyalty_001',
  name: 'Rewards Plus',
  tiers: [
    {
      name: 'Bronze',
      min_points: 0,
      benefits: ['1x points', '5% birthday discount'],
    },
    {
      name: 'Silver',
      min_points: 1000,
      benefits: ['1.5x points', '10% birthday discount', 'Free shipping'],
    },
    {
      name: 'Gold',
      min_points: 5000,
      benefits: [
        '2x points',
        '15% birthday discount',
        'Free shipping',
        'Early access',
      ],
    },
    {
      name: 'Platinum',
      min_points: 15000,
      benefits: [
        '3x points',
        '20% birthday discount',
        'Free shipping',
        'Early access',
        'VIP support',
      ],
    },
  ],
  total_members: 85000,
  active_members: 62000,
};

const mockCustomerLoyalty = {
  customer_id: 'cust_67890',
  program: 'Rewards Plus',
  tier: 'Gold',
  points_balance: 7500,
  points_earned_ytd: 3200,
  points_redeemed_ytd: 1500,
  tier_progress: {
    current_tier: 'Gold',
    next_tier: 'Platinum',
    points_to_next: 7500,
  },
  available_rewards: [
    { id: 'rwd_001', name: '$10 off', points_cost: 500 },
    { id: 'rwd_002', name: '$25 off', points_cost: 1200 },
    { id: 'rwd_003', name: 'Free Product', points_cost: 2500 },
  ],
};

const mockCoupons = [
  {
    code: 'SAVE10',
    discount_type: 'percentage',
    value: 10,
    uses: 1250,
    max_uses: 5000,
    expires: '2026-03-01',
  },
  {
    code: 'FREESHIP',
    discount_type: 'free_shipping',
    value: 0,
    uses: 3400,
    max_uses: 10000,
    expires: '2026-02-28',
  },
  {
    code: 'SPRING25',
    discount_type: 'fixed',
    value: 25,
    uses: 450,
    max_uses: 1000,
    expires: '2026-04-15',
  },
];

function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): unknown {
  console.log(`Handling tool: ${toolName} with args:`, JSON.stringify(args));

  switch (toolName) {
    case 'get_campaign':
      return {
        status: 'success',
        data: {
          ...mockCampaign,
          id: args.campaign_id || mockCampaign.id,
        },
      };

    case 'list_campaigns':
      return {
        status: 'success',
        data: {
          campaigns: [mockCampaign],
          total_count: 1,
        },
      };

    case 'get_customer_session':
      return {
        status: 'success',
        data: {
          ...mockCustomerSession,
          customer_id: args.customer_id || mockCustomerSession.customer_id,
        },
      };

    case 'update_customer_session':
      return {
        status: 'success',
        data: {
          ...mockCustomerSession,
          customer_id: args.customer_id || mockCustomerSession.customer_id,
          cart_items: args.cart_items || mockCustomerSession.cart_items,
          updated_at: new Date().toISOString(),
        },
      };

    case 'get_loyalty_program':
      return {
        status: 'success',
        data: mockLoyaltyProgram,
      };

    case 'get_customer_loyalty':
      return {
        status: 'success',
        data: {
          ...mockCustomerLoyalty,
          customer_id: args.customer_id || mockCustomerLoyalty.customer_id,
        },
      };

    case 'redeem_points': {
      const pointsToRedeem = (args.points as number) || 500;
      return {
        status: 'success',
        data: {
          customer_id: args.customer_id,
          reward_id: args.reward_id,
          points_redeemed: pointsToRedeem,
          new_balance: mockCustomerLoyalty.points_balance - pointsToRedeem,
          redemption_code: `RDM_${Date.now()}`,
          expires: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };
    }

    case 'list_coupons':
      return {
        status: 'success',
        data: {
          coupons: mockCoupons,
          total_count: mockCoupons.length,
        },
      };

    case 'validate_coupon': {
      const coupon = mockCoupons.find((c) => c.code === args.coupon_code);
      if (coupon) {
        return {
          status: 'success',
          data: {
            valid: true,
            coupon,
            message: 'Coupon is valid and can be applied',
          },
        };
      }
      return {
        status: 'success',
        data: {
          valid: false,
          message: 'Coupon code not found or expired',
        },
      };
    }

    case 'create_coupon':
      return {
        status: 'success',
        data: {
          code: args.code || `PROMO_${Date.now()}`,
          discount_type: args.discount_type || 'percentage',
          value: args.value || 10,
          max_uses: args.max_uses || 1000,
          expires:
            args.expires ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

    console.log('TalonOne MCP request:', {
      fullToolName,
      toolName,
      event,
      contextCustom: context.clientContext?.custom,
    });

    // Event contains the tool arguments directly
    const result = handleToolCall(toolName, event);

    return result;
  } catch (err) {
    console.error('TalonOne MCP error:', err);
    return { error: 'Internal server error' };
  }
};
