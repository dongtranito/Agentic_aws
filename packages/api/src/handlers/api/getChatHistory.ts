// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  BedrockAgentCoreClient,
  ListEventsCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { corsHeaders } from './utils/index.js';

const client = new BedrockAgentCoreClient({});
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const MEMORY_ID = process.env.MEMORY_ID!;

/**
 * Extract user ID (sub) from Cognito JWT token
 */
function extractActorId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.claims?.sub as string;
}

/**
 * Lambda handler for GET /chat/:sessionId
 * Retrieves chat history from AgentCore Memory
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'sessionId is required' }),
      };
    }

    const actorId = extractActorId(event);
    // runtimeSessionId must match the format used in putChat
    const runtimeSessionId = `session-${sessionId}`;

    const command = new ListEventsCommand({
      memoryId: MEMORY_ID,
      actorId,
      sessionId: runtimeSessionId,
      includePayloads: true,
      maxResults: 100,
    });

    console.log('ListEvents request:', {
      memoryId: MEMORY_ID,
      actorId,
      sessionId: runtimeSessionId,
    });

    const response = await client.send(command);

    console.log('ListEvents response:', JSON.stringify(response, null, 2));

    // Transform events into chat messages
    const rawMessages: {
      role: 'user' | 'assistant';
      content: string;
      blocks?: { type: string; [key: string]: unknown }[];
    }[] = [];

    for (const event of response.events || []) {
      if (event.payload) {
        for (const payload of event.payload) {
          // Handle conversational payload format
          if ('conversational' in payload && payload.conversational) {
            const conv = payload.conversational as {
              role?: string;
              content?: { text?: string };
            };

            if (conv.content?.text) {
              try {
                const parsed = JSON.parse(conv.content.text);
                if (parsed.message) {
                  const role = parsed.message.role?.toLowerCase();
                  const contentBlocks = parsed.message.content || [];

                  if (role === 'user' || role === 'assistant') {
                    const textParts: string[] = [];
                    const blocks: { type: string; [key: string]: unknown }[] =
                      [];

                    for (const block of contentBlocks) {
                      if (block.text) {
                        textParts.push(block.text);
                        blocks.push({ type: 'text', content: block.text });
                      } else if (block.toolUse) {
                        const rawName = block.toolUse.name || 'unknown';
                        // Strip gateway prefix (target___toolname)
                        const delimIdx = rawName.indexOf('___');
                        const toolName =
                          delimIdx >= 0
                            ? rawName.substring(delimIdx + 3)
                            : rawName;
                        blocks.push({
                          type: 'tool_use',
                          name: toolName,
                          input: block.toolUse.input || {},
                        });
                      } else if (block.toolResult) {
                        const output =
                          block.toolResult.content
                            ?.map((c: { text?: string }) => c.text || '')
                            .join('') || '';
                        // Find the matching tool_use name by toolUseId
                        const toolUseId = block.toolResult.toolUseId;
                        let toolName = 'tool';
                        if (toolUseId) {
                          for (const b of contentBlocks) {
                            if (
                              b.toolUse?.toolUseId === toolUseId &&
                              b.toolUse?.name
                            ) {
                              const raw = b.toolUse.name;
                              const idx = raw.indexOf('___');
                              toolName =
                                idx >= 0 ? raw.substring(idx + 3) : raw;
                              break;
                            }
                          }
                        }
                        blocks.push({
                          type: 'tool_result',
                          name: toolName,
                          status: block.toolResult.status || 'success',
                          output,
                        });
                      }
                    }

                    const content = textParts.join('\n');
                    if (content || blocks.length > 0) {
                      rawMessages.push({
                        role: role as 'user' | 'assistant',
                        content,
                        blocks: blocks.length > 0 ? blocks : undefined,
                      });
                    }
                  }
                }
              } catch (e) {
                console.warn(
                  'Failed to parse event payload:',
                  e,
                  conv.content?.text,
                );
              }
            }
          }
        }
      }
    }

    console.log('Raw messages count:', rawMessages.length);

    // Reverse to get chronological order (oldest first)
    rawMessages.reverse();

    // Consolidate into user-visible messages.
    // Tool result messages (role=user with only toolResult blocks) get
    // merged into the preceding assistant message so the UI shows one
    // coherent assistant bubble with text + tool_use + tool_result blocks.
    const messages: {
      role: 'user' | 'assistant';
      content: string;
      blocks?: { type: string; [key: string]: unknown }[];
    }[] = [];
    for (const msg of rawMessages) {
      const lastMsg = messages[messages.length - 1];

      // Tool result messages (user role, no text, only tool_result blocks)
      // should merge into the preceding assistant message
      const isToolResultOnly =
        msg.role === 'user' &&
        !msg.content &&
        msg.blocks?.every((b) => b.type === 'tool_result');

      if (isToolResultOnly && lastMsg?.role === 'assistant') {
        lastMsg.blocks = [...(lastMsg.blocks || []), ...(msg.blocks || [])];
      } else if (lastMsg && lastMsg.role === msg.role) {
        // Merge consecutive same-role messages
        if (msg.content) {
          lastMsg.content += lastMsg.content
            ? '\n\n' + msg.content
            : msg.content;
        }
        if (msg.blocks) {
          lastMsg.blocks = [...(lastMsg.blocks || []), ...msg.blocks];
        }
      } else if (!isToolResultOnly) {
        messages.push({ ...msg });
      }
    }

    console.log('Consolidated messages count:', messages.length);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ messages }),
    };
  } catch (err) {
    console.error('Error fetching chat history:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to fetch chat history' }),
    };
  }
};
