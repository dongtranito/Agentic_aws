import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  SpaceBetween,
  Box,
  Button,
  Textarea,
  Spinner,
} from '@cloudscape-design/components';
import type { TextareaProps } from '@cloudscape-design/components';
import { useApi } from '../../hooks/useApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const api = useApi();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    try {
      await api.chat.put(
        { id: crypto.randomUUID(), prompt: input.trim() },
        (chunk) => {
          streamingContentRef.current += chunk;
          setStreamingContent(streamingContentRef.current);
        },
      );

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingContentRef.current },
      ]);
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
      setStreamingContent('');
      streamingContentRef.current = '';
    }
  };

  const handleKeyDown: TextareaProps['onKeyDown'] = ({ detail }) => {
    if (detail.key === 'Enter' && !detail.shiftKey) {
      handleSend();
    }
  };

  const messageContainerStyle: React.CSSProperties = {
    height: '400px',
    overflowY: 'auto',
    border: '1px solid var(--color-border-divider-default)',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: 'var(--color-background-container-content)',
  };

  const userMessageStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-background-status-info)',
    borderRadius: '8px',
    marginBottom: '8px',
    marginLeft: '20%',
  };

  const assistantMessageStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-background-container-header)',
    borderRadius: '8px',
    marginBottom: '8px',
    marginRight: '20%',
  };

  return (
    <Container>
      <SpaceBetween size="m">
        <div style={messageContainerStyle}>
          {messages.map((msg, idx) => (
            <Box key={idx} padding="s" data-role={msg.role}>
              <div
                style={
                  msg.role === 'user' ? userMessageStyle : assistantMessageStyle
                }
              >
                <Box padding="s">
                  <Box variant="awsui-key-label">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </Box>
                  <Box>{msg.content}</Box>
                </Box>
              </div>
            </Box>
          ))}
          {isLoading && streamingContent && (
            <Box padding="s">
              <div style={assistantMessageStyle}>
                <Box padding="s">
                  <Box variant="awsui-key-label">Assistant</Box>
                  <Box>{streamingContent}</Box>
                </Box>
              </div>
            </Box>
          )}
          {isLoading && !streamingContent && (
            <Box padding="s">
              <div style={assistantMessageStyle}>
                <Box padding="s">
                  <Spinner /> Thinking...
                </Box>
              </div>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </div>
        <SpaceBetween size="xs" direction="horizontal" alignItems="end">
          <div style={{ flex: 1 }}>
            <Textarea
              value={input}
              onChange={({ detail }) => setInput(detail.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={2}
              disabled={isLoading}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            loading={isLoading}
          >
            Send
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  );
};

export default Chat;
