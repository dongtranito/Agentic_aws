/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { TRPCError } from '@trpc/server';
import { ContextInputOpts } from '../init.js';
import { IPutChatInput, IPutChatOutput } from '../schema/chat.js';

export const putChatLambda = async (
  opts: ContextInputOpts<IPutChatInput>,
): Promise<IPutChatOutput> => {
  const { logger } = opts.ctx;

  logger?.info('Chat request');
  try {
    //const prompt = opts.input.prompt
    //const sessionId = opts.input.id

    return {
      response: '',
    };
  } catch (err) {
    logger?.error('Error executing the request:', { err });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to execute the request',
    });
  }
};
