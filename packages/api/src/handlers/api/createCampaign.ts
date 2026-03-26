// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, corsHeaders } from './utils/index.js';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CAMPAIGNS_TABLE_NAME = process.env.CAMPAIGNS_TABLE_NAME!;

/**
 * Lambda handler for POST /campaign
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { name, description } = body;

    if (!name) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Campaign name is required' }),
      };
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    const campaign = {
      id,
      name,
      description: description ?? '',
      active: 'Y',
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: CAMPAIGNS_TABLE_NAME,
        Item: campaign,
      }),
    );

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(campaign),
    };
  } catch (err) {
    console.error('Error creating campaign:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unable to create campaign' }),
    };
  }
};
