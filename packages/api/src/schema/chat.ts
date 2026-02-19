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
