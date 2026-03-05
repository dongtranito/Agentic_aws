import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StatusIndicator } from '@cloudscape-design/components';
import { ToolBlock } from './ToolBlock';
import type { ContentBlock } from '../types';

interface ContentBlocksProps {
  blocks: ContentBlock[];
  isFinalized?: boolean;
}

export const ContentBlocks = ({ blocks, isFinalized }: ContentBlocksProps) => {
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
      elements.push(
        <ToolBlock
          key={i}
          name={block.name}
          result={block}
          isFinalized={isFinalized}
        />,
      );
      i++;
    } else if (block.type === 'subagent_progress') {
      elements.push(
        <div key={i} className="subagent-progress">
          <StatusIndicator type="in-progress">{block.agent}</StatusIndicator>
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {block.content}
            </ReactMarkdown>
          </div>
        </div>,
      );
      i++;
    } else {
      i++;
    }
  }

  return <div>{elements}</div>;
};
