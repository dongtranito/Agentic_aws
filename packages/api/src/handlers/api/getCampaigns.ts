/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, corsHeaders } from './utils/index.js';

const CAMPAIGNS_TABLE_NAME = process.env.CAMPAIGNS_TABLE_NAME!;
const CAMPAIGN_ACTIVE_INDEX = process.env.CAMPAIGN_ACTIVE_INDEX!;

/**
 * Lambda handler for GET /campaign
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    const response = await ddb.send(
      new QueryCommand({
        TableName: CAMPAIGNS_TABLE_NAME,
        IndexName: CAMPAIGN_ACTIVE_INDEX,
        KeyConditionExpression: 'active = :active',
        ExpressionAttributeValues: {
          ':active': 'Y',
        },
        ScanIndexForward: false,
      }),
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ campaigns: response.Items ?? [] }),
    };
  } catch (err) {
    console.error('Error getting campaigns:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to get campaigns' }),
    };
  }
};
