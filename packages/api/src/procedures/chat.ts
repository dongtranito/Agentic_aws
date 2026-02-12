import { publicProcedure } from '../init.js';
import { putChatLambda } from '../lambdas/putChat.js';
import { PutChatRequestSchema, PutChatResponseSchema } from '../schema/chat.js';

export const putChat = publicProcedure
  .input(PutChatRequestSchema)
  .output(PutChatResponseSchema)
  .query(putChatLambda);
