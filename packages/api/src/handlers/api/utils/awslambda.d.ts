/**
 * Type declarations for the AWS Lambda streaming runtime globals.
 * These are available in the Node.js 18+ Lambda runtime when using response streaming.
 */

type StreamifyHandler = (
  event: import('aws-lambda').APIGatewayProxyEvent,
  responseStream: NodeJS.WritableStream,
  context?: import('aws-lambda').Context,
) => Promise<void>;

interface HttpResponseStreamStatic {
  from(
    stream: NodeJS.WritableStream,
    metadata: {
      statusCode: number;
      headers?: Record<string, string>;
    },
  ): NodeJS.WritableStream;
}

declare namespace awslambda {
  function streamifyResponse(handler: StreamifyHandler): unknown;
  const HttpResponseStream: HttpResponseStreamStatic;
}
