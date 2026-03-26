// Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import { useState } from 'react';
import {
  SpaceBetween,
  Box,
  Modal,
  Button,
} from '@cloudscape-design/components';
import { CodeView } from '@cloudscape-design/code-view';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApi } from '../../../hooks/useApi';

const OUTPUT_INLINE_LIMIT = 500;
const MODAL_SIZE_LIMIT = 500_000;

const formatOutput = (output: string): string => {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
};

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

export const ToolOutput = ({ output }: { output: string }) => {
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
        window.open(presignedUrl, '_blank');
      } else {
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
    <div>
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
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fullContent ?? formatted}
          </ReactMarkdown>
        </div>
      </Modal>
    </div>
  );
};
