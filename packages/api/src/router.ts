import {
  awsLambdaRequestHandler,
  CreateAWSLambdaContextOptions,
} from '@trpc/server/adapters/aws-lambda';
import { campaignsRouter } from './routers/campaigns.js';
import { t } from './init.js';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { chatRouter } from './routers/chat.js';

export const router = t.router;

export const appRouter = router({
  campaign: campaignsRouter,
  chat: chatRouter,
});

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: (ctx: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>) =>
    ctx,
  responseMeta: ({ ctx }) => {
    return {
      headers: {
        'Access-Control-Allow-Origin': getAllowedOrigin(ctx?.event),
        'Access-Control-Allow-Methods': '*',
      },
    };
  },
});

const getAllowedOrigin = (event: APIGatewayProxyEvent | undefined) => {
  const origin = event?.headers?.origin ?? event?.headers?.Origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  const isLocalHost =
    origin && new Set(['localhost', '127.0.0.1']).has(new URL(origin).hostname);
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  let corsOrigin = '*';
  if (allowedOrigins.length > 0 && !isLocalHost) {
    corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  }
  return corsOrigin;
};

export type AppRouter = typeof appRouter;
