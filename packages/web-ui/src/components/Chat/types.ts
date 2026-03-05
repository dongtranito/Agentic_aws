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
