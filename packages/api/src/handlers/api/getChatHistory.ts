/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
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
    const rawMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const event of response.events || []) {
      if (event.payload) {
        for (const payload of event.payload) {
          // Handle conversational payload format
          if ('conversational' in payload && payload.conversational) {
            const conv = payload.conversational as {
              role?: string;
              content?: { text?: string };
            };

            // The content.text contains a JSON string with the actual message
            if (conv.content?.text) {
              try {
                const parsed = JSON.parse(conv.content.text);
                if (parsed.message) {
                  const role = parsed.message.role?.toLowerCase();
                  const content = parsed.message.content?.[0]?.text || '';

                  if ((role === 'user' || role === 'assistant') && content) {
                    rawMessages.push({
                      role: role as 'user' | 'assistant',
                      content,
                    });
                  }
                }
              } catch {
                // Skip if JSON parsing fails
              }
            }
          }
        }
      }
    }

    console.log('Raw messages count:', rawMessages.length);

    // Reverse to get chronological order (oldest first)
    rawMessages.reverse();

    // Consolidate consecutive messages from the same role
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const msg of rawMessages) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === msg.role) {
        // Append to previous message with newline separator
        lastMsg.content += '\n\n' + msg.content;
      } else {
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
