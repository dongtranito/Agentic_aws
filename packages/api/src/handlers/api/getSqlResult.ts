// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { corsHeaders } from './utils/index.js';

const s3 = new S3Client({});
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const SQL_RESULTS_BUCKET = process.env.SQL_RESULTS_BUCKET!;

/**
 * Lambda handler for GET /sql-result/{key+}
 * Returns a presigned URL to download the full SQL result from S3.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const key = event.pathParameters?.key;

    if (!key) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'key is required' }),
      };
    }

    const command = new GetObjectCommand({
      Bucket: SQL_RESULTS_BUCKET,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ url: presignedUrl }),
    };
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to generate download URL' }),
    };
  }
};
