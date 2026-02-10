/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let ddbClient: DynamoDBDocumentClient | null = null;

export const getDdbClient = () => {
  if (ddbClient == null) {
    ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  return ddbClient;
};
