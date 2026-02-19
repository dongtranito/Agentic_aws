import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  SpaceBetween,
  Box,
  Header,
  LiveRegion,
  PromptInput,
} from '@cloudscape-design/components';
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble';
import Avatar from '@cloudscape-design/chat-components/avatar';
import LoadingBar from '@cloudscape-design/chat-components/loading-bar';
import { useApi } from '../../hooks/useApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  campaignId?: string;
}

export const Chat = ({ campaignId }: ChatProps) => {
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
        { sessionId: campaignId!, prompt: input.trim() },
        (chunk) => {
          streamingContentRef.current += chunk;
          setStreamingContent(streamingContentRef.current);
        },
      );

      const finalContent = streamingContentRef.current;
      if (finalContent) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: finalContent },
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
      setStreamingContent('');
      streamingContentRef.current = '';
    }
  };

  const chatContainerStyle: React.CSSProperties = {
    height: '400px',
    overflowY: 'auto',
    padding: '12px',
  };

  const userBubbleStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  };

  return (
    <Container header={<Header>Chat</Header>}>
      <SpaceBetween size="m">
        <div
          role="region"
          aria-label="Chat messages"
          style={chatContainerStyle}
        >
          <SpaceBetween size="m">
            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <div key={idx} style={userBubbleStyle}>
                  <ChatBubble
                    ariaLabel={`You: ${msg.content}`}
                    type="outgoing"
                    avatar={
                      <Avatar ariaLabel="User" color="default" initials="U" />
                    }
                    hideAvatar
                  >
                    {msg.content}
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
                  {msg.content}
                </ChatBubble>
              ),
            )}
            {isLoading && streamingContent && (
              <ChatBubble
                ariaLabel={`AI Assistant: ${streamingContent}`}
                type="incoming"
                avatar={
                  <Avatar
                    ariaLabel="AI Assistant"
                    color="gen-ai"
                    initials="AI"
                  />
                }
              >
                {streamingContent}
              </ChatBubble>
            )}
            {isLoading && !streamingContent && (
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
                <Box>
                  <LoadingBar variant="gen-ai" />
                </Box>
              </ChatBubble>
            )}
          </SpaceBetween>
          <div ref={messagesEndRef} />
        </div>
        <LiveRegion hidden>
          {messages.length > 0 && messages[messages.length - 1].content}
        </LiveRegion>
        {isLoading && <LoadingBar variant="gen-ai" />}
        <PromptInput
          value={input}
          onChange={({ detail }) => setInput(detail.value)}
          onAction={handleSend}
          placeholder="Ask a question"
          disabled={isLoading}
          actionButtonIconName="send"
          actionButtonAriaLabel="Send"
        />
      </SpaceBetween>
    </Container>
  );
};

export default Chat;
