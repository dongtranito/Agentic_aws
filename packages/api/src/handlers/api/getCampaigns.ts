/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, corsHeaders } from './utils/index.js';
import { GetCampaignsInputSchema } from '../../schema/campaign.js';

const CAMPAIGNS_TABLE_NAME = process.env.CAMPAIGNS_TABLE_NAME!;
const CAMPAIGN_ACTIVE_INDEX = process.env.CAMPAIGN_ACTIVE_INDEX!;

/**
 * Lambda handler for GET /campaign
 * Supports pagination via pageSize and nextToken query parameters
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters ?? {};
    const parsed = GetCampaignsInputSchema.safeParse(queryParams);

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: parsed.error.message }),
      };
    }

    const { pageSize, nextToken } = parsed.data;

    // Decode nextToken if provided
    let exclusiveStartKey: Record<string, unknown> | undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(nextToken, 'base64').toString('utf-8'),
        );
      } catch {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid nextToken' }),
        };
      }
    }

    const response = await ddb.send(
      new QueryCommand({
        TableName: CAMPAIGNS_TABLE_NAME,
        IndexName: CAMPAIGN_ACTIVE_INDEX,
        KeyConditionExpression: 'active = :active',
        ExpressionAttributeValues: {
          ':active': 'Y',
        },
        ScanIndexForward: false,
        Limit: pageSize,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    // Encode LastEvaluatedKey as nextToken
    let responseNextToken: string | undefined;
    if (response.LastEvaluatedKey) {
      responseNextToken = Buffer.from(
        JSON.stringify(response.LastEvaluatedKey),
      ).toString('base64');
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        campaigns: response.Items ?? [],
        nextToken: responseNextToken,
      }),
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
