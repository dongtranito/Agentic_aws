/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { TRPCError } from '@trpc/server';
import { ContextInputOpts } from '../init.js';
import { getDdbClient } from './utils/index.js';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { IGetCampaignInput, IGetCampaignOutput } from '../schema/campaign.js';

export const getCampaignLambda = async (
  opts: ContextInputOpts<IGetCampaignInput>,
): Promise<IGetCampaignOutput> => {
  const { logger } = opts.ctx;

  logger?.info('Get Campaign');
  try {
    const { id } = opts.input;
    const ddb = getDdbClient();
    const response = await ddb.send(
      new GetCommand({
        TableName: process.env['CAMPAIGNS_TABLE_NAME'],
        Key: { id },
      }),
    );

    if (!response.Item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Config not found',
      });
    }

    return response.Item as IGetCampaignOutput;
  } catch (err) {
    logger?.error('Error getting the campaign:', { err });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to get the campaign',
    });
  }
};
