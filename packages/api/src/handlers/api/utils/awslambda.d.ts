// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/

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
