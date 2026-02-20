/**
 * Shared utilities for AgentCore Gateway MCP Lambda handlers
 */

export interface GatewayClientContext {
  custom?: {
    bedrockAgentCoreToolName?: string;
    bedrockAgentCoreMessageVersion?: string;
    bedrockAgentCoreAwsRequestId?: string;
    bedrockAgentCoreMcpMessageId?: string;
    bedrockAgentCoreGatewayId?: string;
    bedrockAgentCoreTargetId?: string;
  };
}

export interface GatewayContext {
  clientContext?: GatewayClientContext;
}

/**
 * Extracts the tool name from the full Gateway tool name.
 * Gateway format: ${target_name}___${tool_name} (three underscores)
 */
export function extractToolName(fullToolName: string): string {
  const delimiter = '___';
  const idx = fullToolName.indexOf(delimiter);
  return idx >= 0
    ? fullToolName.substring(idx + delimiter.length)
    : fullToolName;
}
