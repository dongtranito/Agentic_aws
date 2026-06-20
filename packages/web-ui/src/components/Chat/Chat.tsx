// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  SpaceBetween,
  Box,
  Header,
  LiveRegion,
  PromptInput,
  Spinner,
} from '@cloudscape-design/components';
import type { PromptInputProps } from '@cloudscape-design/components/prompt-input';
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble';
import Avatar from '@cloudscape-design/chat-components/avatar';
import LoadingBar from '@cloudscape-design/chat-components/loading-bar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApi } from '../../hooks/useApi';
import { ContentBlocks } from './components/ContentBlocks';
import type { ContentBlock, Message } from './types';
import './Chat.css';

interface ChatProps {
  campaignId?: string;
}

export const Chat = ({ campaignId }: ChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [streamingBlocks, setStreamingBlocks] = useState<ContentBlock[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<ContentBlock[]>([]);
  const sseBufferRef = useRef('');
  const promptRef = useRef<PromptInputProps.Ref>(null);
  const api = useApi();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingBlocks, scrollToBottom]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!campaignId) {
        setIsLoadingHistory(false);
        return;
      }
      try {
        const history = await api.chat.getHistory(campaignId);
        setMessages(history.messages || []);
      } catch (error) {
        // [VI] Ghi log lỗi khi tải lịch sử trò chuyện
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [campaignId, api.chat]);

  useEffect(() => {
    if (!isLoadingHistory) {
      promptRef.current?.focus();
    }
  }, [isLoadingHistory]);

  const appendBlock = (block: ContentBlock) => {
    const blocks = blocksRef.current;
    const last = blocks[blocks.length - 1];

    if (block.type === 'text' && last?.type === 'text') {
      last.content += block.content;
    } else if (
      block.type === 'tool_use' &&
      last?.type === 'tool_use' &&
      last.name === block.name
    ) {
      last.input = block.input;
    } else {
      blocks.push(block);
    }
    blocksRef.current = [...blocks];
    setStreamingBlocks(blocksRef.current);
  };

  const appendSubagentProgress = (agent: string, content: string) => {
    const blocks = blocksRef.current;
    // Find the last tool_use block to attach progress to
    // [VI] Tìm block tool_use cuối cùng để gắn thông tin tiến độ vào
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === 'tool_use') {
        const toolBlock = blocks[i] as ContentBlock & { type: 'tool_use' };
        toolBlock.progress = (toolBlock.progress ?? '') + content;
        blocksRef.current = [...blocks];
        setStreamingBlocks(blocksRef.current);
        return;
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingBlocks([]);
    blocksRef.current = [];
    sseBufferRef.current = '';

    try {
      await api.chat.put(
        { sessionId: campaignId ?? '', prompt: input.trim() },
        (chunk) => {
          sseBufferRef.current += chunk;
          const parts = sseBufferRef.current.split('\n');
          sseBufferRef.current = parts.pop() ?? '';

          for (const line of parts) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'text') {
                appendBlock({ type: 'text', content: event.content });
              } else if (event.type === 'tool_use') {
                appendBlock({
                  type: 'tool_use',
                  name: event.name,
                  input: event.input,
                });
              } else if (event.type === 'tool_result') {
                appendBlock({
                  type: 'tool_result',
                  name: event.name,
                  status: event.status,
                  output: event.output,
                });
              } else if (event.type === 'subagent_progress') {
                appendSubagentProgress(event.agent, event.content);
              }
            } catch {
              // Not valid JSON — ignore
              // [VI] Không phải JSON hợp lệ — bỏ qua
            }
          }
        },
      );

      const finalBlocks = blocksRef.current.map((b) => {
        if (b.type === 'tool_use') {
          // Strip progress from finalized blocks — it's ephemeral
          // [VI] Loại bỏ thông tin tiến độ khỏi các block đã hoàn tất — vì nó chỉ là tạm thời
          const { progress: _, ...rest } = b;
          return rest;
        }
        return b;
      });
      if (finalBlocks.length > 0) {
        const textContent = finalBlocks
          .filter(
            (b): b is ContentBlock & { type: 'text' } => b.type === 'text',
          )
          .map((b) => b.content)
          .join('');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: textContent, blocks: [...finalBlocks] },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingBlocks([]);
      blocksRef.current = [];
      sseBufferRef.current = '';
    }
  };

  const hasStreamingContent = streamingBlocks.length > 0;
  const lastBlockType = streamingBlocks[streamingBlocks.length - 1]?.type;
  const isToolActive = hasStreamingContent && lastBlockType === 'tool_use';

  return (
    <Container header={<Header>Chat</Header>}>
      <SpaceBetween size="m">
        <div
          role="region"
          aria-label="Chat messages"
          className="chat-container"
        >
          {isLoadingHistory ? (
            <Box textAlign="center" padding="l">
              <Spinner size="large" />
            </Box>
          ) : (
            <SpaceBetween size="m">
              {messages.map((msg, idx) =>
                msg.role === 'user' ? (
                  <div key={idx} className="chat-user-bubble">
                    <ChatBubble
                      ariaLabel={`You: ${msg.content}`}
                      type="outgoing"
                      avatar={
                        <Avatar ariaLabel="User" color="default" initials="U" />
                      }
                      hideAvatar
                    >
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </ChatBubble>
                    <div style={{ marginLeft: '8px' }}>
                      <Avatar ariaLabel="User" color="default" initials="U" />
                    </div>
                  </div>
                ) : (
                  <ChatBubble
                    key={idx}
                    ariaLabel={`AI Assistant: ${msg.content}`}
                    type="incoming"
                    avatar={
                      <Avatar
                        ariaLabel="AI Assistant"
                        color="gen-ai"
                        initials="AI"
                      />
                    }
                  >
                    {msg.blocks ? (
                      <ContentBlocks blocks={msg.blocks} isFinalized />
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </ChatBubble>
                ),
              )}
              {isLoading && hasStreamingContent && (
                <ChatBubble
                  ariaLabel="AI Assistant is responding"
                  type="incoming"
                  avatar={
                    <Avatar
                      ariaLabel="AI Assistant"
                      color="gen-ai"
                      initials="AI"
                      loading={isToolActive}
                    />
                  }
                >
                  <ContentBlocks blocks={streamingBlocks} />
                </ChatBubble>
              )}
              {isLoading && !hasStreamingContent && (
                <ChatBubble
                  ariaLabel="AI Assistant is thinking"
                  type="incoming"
                  avatar={
                    <Avatar
                      ariaLabel="AI Assistant"
                      color="gen-ai"
                      initials="AI"
                      loading
                    />
                  }
                >
                  <LoadingBar variant="gen-ai" />
                </ChatBubble>
              )}
            </SpaceBetween>
          )}
          <div ref={messagesEndRef} />
        </div>
        <LiveRegion hidden>
          {messages.length > 0 && messages[messages.length - 1].content}
        </LiveRegion>
        {isLoading && <LoadingBar variant="gen-ai" />}
        <PromptInput
          ref={promptRef}
          value={input}
          onChange={({ detail }) => setInput(detail.value)}
          onAction={handleSend}
          placeholder={isLoadingHistory ? 'Loading...' : 'Ask a question'}
          disabled={isLoading || isLoadingHistory}
          actionButtonIconName="send"
          actionButtonAriaLabel="Send"
        />
      </SpaceBetween>
    </Container>
  );
};

export default Chat;
