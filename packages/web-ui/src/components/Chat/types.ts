// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
export type ContentBlock =
  | { type: 'text'; content: string }
  | {
      type: 'tool_use';
      name: string;
      input?: Record<string, unknown>;
      progress?: string;
    }
  | { type: 'tool_result'; name: string; status: string; output: string };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  blocks?: ContentBlock[];
}
