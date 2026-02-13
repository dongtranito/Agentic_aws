/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const client = new BedrockAgentCoreClient({});
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN!;

/**
 * Streaming Lambda handler for PUT /chat
 * Invokes the AgentCore runtime and streams the response.
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      httpResponseMetadata,
    );

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { prompt, id: sessionId } = body;

      const payload = JSON.stringify({ prompt });

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        runtimeSessionId: sessionId,
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
      console.error('Error invoking agent runtime:', err);
      responseStream.write(
        JSON.stringify({ error: 'Unable to execute the request' }),
      );
    } finally {
      responseStream.end();
    }
  },
);
