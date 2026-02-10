/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { TRPCError } from '@trpc/server';
import { ContextInputOpts } from '../init.js';
// import { getDdbClient } from './utils/index.js';
// import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { IGetCampaignInput, IGetCampaignOutput } from '../schema/campaign.js';

export const getConfigLambda = async (
  opts: ContextInputOpts<IGetCampaignInput>,
): Promise<IGetCampaignOutput> => {
  const { logger } = opts.ctx;

  logger?.info('Get Config');

  try {
    return {
      id: '1',
      name: 'one',
      createdAt: 1,
      updatedAt: 1,
    };
  } catch (err) {
    logger?.error('Error getting config:', { err });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to get the config',
    });
  }
};
