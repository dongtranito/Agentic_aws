// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { corsHeaders } from './utils/index.js';

const client = new BedrockAgentCoreClient({});

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN!;

/**
 * Extract user ID (sub) from Cognito JWT token
 *
 * [VI] Trích xuất user ID (trường "sub") từ token JWT của Cognito
 */
function extractActorId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.claims?.sub as string;
}

/**
 * Streaming Lambda handler for PUT /chat
 * Invokes the AgentCore runtime and streams the response.
 *
 * [VI] Lambda handler dạng streaming cho PUT /chat
 * Gọi AgentCore runtime và truyền (stream) phản hồi về.
 */
export const handler = awslambda.streamifyResponse(
  async (
    event: APIGatewayProxyEvent,
    responseStream: NodeJS.WritableStream,
  ): Promise<void> => {
    const httpResponseMetadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders,
      },
    };

    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      httpResponseMetadata,
    );

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { prompt, sessionId } = body;

      if (!sessionId) {
        responseStream.write(
          JSON.stringify({ error: 'sessionId is required' }),
        );
        return;
      }

      const actorId = extractActorId(event);

      // runtimeSessionId must be at least 33 characters
      // [VI] runtimeSessionId phải dài tối thiểu 33 ký tự
      const runtimeSessionId = `session-${sessionId}`;

      const payload = JSON.stringify({ prompt, actorId });

      // [VI] Ghi log thông tin gọi agent (ARN runtime, session, actor và prompt)
      console.log('Invoking agent with:', {
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        sessionId: runtimeSessionId,
        actorId,
        prompt,
      });

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        runtimeSessionId,
        payload: new TextEncoder().encode(payload),
      });

      const response = await client.send(command);

      if (response.response) {
        const stream = response.response;
        for await (const chunk of stream as AsyncIterable<Uint8Array>) {
          const text =
            typeof chunk === 'string'
              ? chunk
              : new TextDecoder('utf-8').decode(chunk);
          responseStream.write(text);
        }
      }
    } catch (err) {
      // [VI] Ghi log lỗi khi gọi agent runtime
      console.error('Error invoking agent runtime:', err);
      responseStream.write(
        JSON.stringify({ error: 'Unable to execute the request' }),
      );
    } finally {
      responseStream.end();
    }
  },
);
