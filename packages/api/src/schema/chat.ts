// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { z } from 'zod';

// Chat
// [VI] Trò chuyện (Chat)

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
// [VI] Lịch sử trò chuyện

export const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({
    type: z.literal('tool_use'),
    name: z.string(),
    input: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('tool_result'),
    name: z.string(),
    status: z.string(),
    output: z.string(),
  }),
]);

export type IContentBlock = z.TypeOf<typeof ContentBlockSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  blocks: z.array(ContentBlockSchema).optional(),
});

export type IChatMessage = z.TypeOf<typeof ChatMessageSchema>;

export const GetChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});

export type IGetChatHistoryOutput = z.TypeOf<
  typeof GetChatHistoryResponseSchema
>;

// SQL Result
// [VI] Kết quả SQL

export const GetSqlResultResponseSchema = z.object({
  url: z.string(),
});

export type IGetSqlResultOutput = z.TypeOf<typeof GetSqlResultResponseSchema>;
