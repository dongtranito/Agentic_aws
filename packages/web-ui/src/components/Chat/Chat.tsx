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
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble';
import Avatar from '@cloudscape-design/chat-components/avatar';
import LoadingBar from '@cloudscape-design/chat-components/loading-bar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
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

  // Load chat history on mount
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
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [campaignId, api.chat]);

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

  const markdownStyles = `
    .markdown-content p { margin: 0 0 0.5em 0; }
    .markdown-content p:last-child { margin-bottom: 0; }
    .markdown-content ul, .markdown-content ol { margin: 0.5em 0; padding-left: 1.5em; }
    .markdown-content li { margin: 0.25em 0; }
    .markdown-content code { 
      background-color: rgba(0, 0, 0, 0.1); 
      padding: 0.1em 0.3em; 
      border-radius: 3px; 
      font-family: monospace;
      font-size: 0.9em;
    }
    .markdown-content pre { 
      background-color: rgba(0, 0, 0, 0.1); 
      padding: 0.75em; 
      border-radius: 4px; 
      overflow-x: auto;
      margin: 0.5em 0;
    }
    .markdown-content pre code { 
      background-color: transparent; 
      padding: 0; 
    }
    .markdown-content table { border-collapse: collapse; margin: 0.5em 0; }
    .markdown-content th, .markdown-content td { 
      border: 1px solid rgba(0, 0, 0, 0.2); 
      padding: 0.5em; 
    }
    .markdown-content blockquote {
      border-left: 3px solid rgba(0, 0, 0, 0.2);
      margin: 0.5em 0;
      padding-left: 1em;
      color: rgba(0, 0, 0, 0.7);
    }
  `;

  return (
    <Container header={<Header>Chat</Header>}>
      <style>{markdownStyles}</style>
      <SpaceBetween size="m">
        <div
          role="region"
          aria-label="Chat messages"
          style={chatContainerStyle}
        >
          {isLoadingHistory ? (
            <Box textAlign="center" padding="l">
              <Spinner size="large" />
            </Box>
          ) : (
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
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
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
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
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
          )}
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
