// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, corsHeaders } from './utils/index.js';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CAMPAIGNS_TABLE_NAME = process.env.CAMPAIGNS_TABLE_NAME!;

/**
 * Lambda handler for GET /campaign/:id
 *
 * [VI] Lambda handler cho GET /campaign/:id (lấy một chiến dịch theo ID)
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Campaign ID is required' }),
      };
    }

    const response = await ddb.send(
      new GetCommand({
        TableName: CAMPAIGNS_TABLE_NAME,
        Key: { id },
      }),
    );

    if (!response.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Campaign not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.Item),
    };
  } catch (err) {
    // [VI] Ghi log lỗi khi lấy chiến dịch
    console.error('Error getting campaign:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to get the campaign' }),
    };
  }
};
