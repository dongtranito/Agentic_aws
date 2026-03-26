// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import {
  SpaceBetween,
  Box,
  ExpandableSection,
  StatusIndicator,
} from '@cloudscape-design/components';
import { CodeView } from '@cloudscape-design/code-view';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolOutput } from './ToolOutput';
import type { ContentBlock } from '../types';

interface ToolBlockProps {
  name: string;
  input?: Record<string, unknown>;
  progress?: string;
  result?: ContentBlock & { type: 'tool_result' };
  isFinalized?: boolean;
}

export const ToolBlock = ({
  name,
  input,
  progress,
  result,
  isFinalized,
}: ToolBlockProps) => {
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
          {progress && !result && (
            <Box>
              <Box fontSize="body-s" fontWeight="bold">
                Agent Logs
              </Box>
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {progress}
                </ReactMarkdown>
              </div>
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
