/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

// Chat

export const PutChatRequestSchema = z.object({
  sessionId: z.string(),
  prompt: z.string(),
});

export type IPutChatInput = z.TypeOf<typeof PutChatRequestSchema>;

export const PutChatResponseSchema = z.object({
  response: z.string(),
});

export type IPutChatOutput = z.TypeOf<typeof PutChatResponseSchema>;

// Chat History

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export type IChatMessage = z.TypeOf<typeof ChatMessageSchema>;

export const GetChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});

export type IGetChatHistoryOutput = z.TypeOf<
  typeof GetChatHistoryResponseSchema
>;
