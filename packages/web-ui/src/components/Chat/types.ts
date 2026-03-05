export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; input?: Record<string, unknown> }
  | { type: 'tool_result'; name: string; status: string; output: string }
  | { type: 'subagent_progress'; agent: string; content: string };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  blocks?: ContentBlock[];
}
