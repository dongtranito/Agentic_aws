import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  SpaceBetween,
  Box,
  Header,
  LiveRegion,
  PromptInput,
  Spinner,
  ExpandableSection,
  StatusIndicator,
  Modal,
  Button,
} from '@cloudscape-design/components';
import { CodeView } from '@cloudscape-design/code-view';
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble';
import Avatar from '@cloudscape-design/chat-components/avatar';
import LoadingBar from '@cloudscape-design/chat-components/loading-bar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApi } from '../../hooks/useApi';

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; input?: Record<string, unknown> }
  | { type: 'tool_result'; name: string; status: string; output: string };

interface Message {
  role: 'user' | 'assistant';
  content: string;
  blocks?: ContentBlock[];
}

interface ChatProps {
  campaignId?: string;
}

const formatOutput = (output: string): string => {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
};

const OUTPUT_INLINE_LIMIT = 500;

/**
 * Tries to extract a `_truncated.full_result_s3_uri` from the output JSON.
 */
/**
 * Tries to extract truncation metadata from the output JSON.
 */
const extractTruncationInfo = (
  output: string,
): { s3Uri: string; bytes: number } | null => {
  try {
    const parsed = JSON.parse(output);
    const t = parsed?._truncated;
    if (t?.full_result_s3_uri) {
      return { s3Uri: t.full_result_s3_uri, bytes: t.full_result_bytes ?? 0 };
    }
    return null;
  } catch {
    return null;
  }
};

const MODAL_SIZE_LIMIT = 500_000; // 500KB — above this, open in new tab

const ToolOutput = ({ output }: { output: string }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const api = useApi();

  const formatted = formatOutput(output);
  const isLarge = formatted.length > OUTPUT_INLINE_LIMIT;
  const truncation = extractTruncationInfo(output);

  const handleViewFull = async () => {
    if (!truncation) {
      setModalVisible(true);
      return;
    }

    setLoadingFull(true);
    try {
      const presignedUrl = await api.sqlResult.getUrl(truncation.s3Uri);

      if (truncation.bytes > MODAL_SIZE_LIMIT) {
        // Too large for modal — open in new tab
        window.open(presignedUrl, '_blank');
      } else {
        // Small enough — fetch and show in modal
        const response = await fetch(presignedUrl);
        const text = await response.text();
        setFullContent(formatOutput(text));
        setModalVisible(true);
      }
    } catch (err) {
      console.error('Failed to load full result:', err);
    } finally {
      setLoadingFull(false);
    }
  };

  if (!output) return <Box color="text-body-secondary">No output</Box>;

  if (!isLarge && !truncation) {
    return <CodeView content={formatted} wrapLines />;
  }

  return (
    <>
      <SpaceBetween size="xs">
        <CodeView
          content={
            isLarge
              ? formatted.slice(0, OUTPUT_INLINE_LIMIT) + '\n...'
              : formatted
          }
          wrapLines
        />
        <Button variant="link" onClick={handleViewFull} loading={loadingFull}>
          {truncation && truncation.bytes > MODAL_SIZE_LIMIT
            ? 'Download full result'
            : 'View full output'}
        </Button>
      </SpaceBetween>
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header="Tool Output"
        size="large"
      >
        <CodeView content={fullContent ?? formatted} wrapLines />
      </Modal>
    </>
  );
};

const ToolBlock = ({
  name,
  input,
  result,
  isFinalized,
}: {
  name: string;
  input?: Record<string, unknown>;
  result?: ContentBlock & { type: 'tool_result' };
  isFinalized?: boolean;
}) => {
  const isComplete = !!result || !!isFinalized;
  const isSuccess = result ? result.status === 'success' : isFinalized;

  const header = (
    <StatusIndicator
      type={isComplete ? (isSuccess ? 'success' : 'error') : 'in-progress'}
    >
      {name}
    </StatusIndicator>
  );

  return (
    <Box padding={{ vertical: 'xxs' }}>
      <ExpandableSection
        variant="footer"
        defaultExpanded={false}
        headerText={header}
      >
        <SpaceBetween size="xs">
          {input && (
            <Box>
              <Box fontSize="body-s" fontWeight="bold">
                Input
              </Box>
              <CodeView
                content={
                  typeof input === 'string'
                    ? input
                    : JSON.stringify(input, null, 2)
                }
                wrapLines
              />
            </Box>
          )}
          {result && (
            <Box>
              <Box fontSize="body-s" fontWeight="bold">
                Output
              </Box>
              <ToolOutput output={result.output} />
            </Box>
          )}
        </SpaceBetween>
      </ExpandableSection>
    </Box>
  );
};

const ContentBlocks = ({
  blocks,
  isFinalized,
}: {
  blocks: ContentBlock[];
  isFinalized?: boolean;
}) => {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'text') {
      if (block.content) {
        elements.push(
          <div key={i} className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {block.content}
            </ReactMarkdown>
          </div>,
        );
      }
      i++;
    } else if (block.type === 'tool_use') {
      // Look ahead for matching tool_result
      const next = blocks[i + 1];
      if (next?.type === 'tool_result') {
        elements.push(
          <ToolBlock
            key={i}
            name={block.name}
            input={block.input}
            result={next}
            isFinalized={isFinalized}
          />,
        );
        i += 2;
      } else {
        elements.push(
          <ToolBlock
            key={i}
            name={block.name}
            input={block.input}
            isFinalized={isFinalized}
          />,
        );
        i++;
      }
    } else if (block.type === 'tool_result') {
      // Orphan tool_result (no preceding tool_use) — render standalone
      elements.push(
        <ToolBlock
          key={i}
          name={block.name}
          result={block}
          isFinalized={isFinalized}
        />,
      );
      i++;
    } else {
      i++;
    }
  }

  return <>{elements}</>;
};

export const Chat = ({ campaignId }: ChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [streamingBlocks, setStreamingBlocks] = useState<ContentBlock[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<ContentBlock[]>([]);
  const sseBufferRef = useRef('');
  const api = useApi();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingBlocks, scrollToBottom]);

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

  const appendBlock = (block: ContentBlock) => {
    const blocks = blocksRef.current;
    const last = blocks[blocks.length - 1];

    // Merge consecutive text blocks
    if (block.type === 'text' && last?.type === 'text') {
      last.content += block.content;
    } else if (
      block.type === 'tool_use' &&
      last?.type === 'tool_use' &&
      last.name === block.name
    ) {
      // Update existing tool_use input in-place
      last.input = block.input;
    } else {
      blocks.push(block);
    }
    blocksRef.current = [...blocks];
    setStreamingBlocks(blocksRef.current);
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
        { sessionId: campaignId!, prompt: input.trim() },
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
              }
            } catch {
              // Not valid JSON — ignore
            }
          }
        },
      );

      const finalBlocks = blocksRef.current;
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

  const chatContainerStyle: React.CSSProperties = {
    height: '600px',
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

  const hasStreamingContent = streamingBlocks.length > 0;
  const isToolActive =
    hasStreamingContent &&
    streamingBlocks[streamingBlocks.length - 1]?.type === 'tool_use';

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
