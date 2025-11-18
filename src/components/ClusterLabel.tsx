import React from 'react';
import { Typography } from '@mui/material';
import type { TypographyProps } from '@mui/material/Typography';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ClusterLabelProps {
  /**
   * Cluster label text to render.
   *
   * Expected format:
   * - Plain string or Markdown-formatted string
   *   (e.g., `*Failure Pattern*: description`).
   */
  text: string;
  /**
   * Optional props forwarded to the underlying `Typography` component
   * controlling visual appearance (variant, sx, component, etc.).
   */
  typographyProps?: TypographyProps;
}

/**
 * Normalize common malformed markdown patterns in cluster labels.
 *
 * Handles cases like:
 * - `*Unverified Answer**: ...` → `*Unverified Answer*: ...`
 */
function normalizeClusterLabelMarkdown(raw: string): string {
  if (!raw) return raw;
  let text = raw;

  // 1. Fix patterns where there is a single leading `*` and double trailing `**`
  //    before whitespace, colon, or end-of-string: `*Title**:` → `**Title**:`
  text = text.replace(/^\*([^*]+)\*\*(?=\s|:|$)/, '**$1**');

  // 2. Promote leading italic segment `*Title*` to bold `**Title**`
  //    so cluster names stand out visually.
  text = text.replace(/^\*([^*]+)\*(?=\s|:|$)/, '**$1**');

  return text;
}

/**
 * `ClusterLabel` renders cluster names with lightweight Markdown support.
 *
 * - Supports basic Markdown such as bold/italics and inline lists.
 * - Avoids extra paragraph spacing by rendering Markdown paragraphs as fragments.
 * - Applies a small normalization pass for common malformed markdown in labels.
 */
export function ClusterLabel({ text, typographyProps }: ClusterLabelProps) {
  const normalized = normalizeClusterLabelMarkdown(text);

  return (
    <Typography
      {...typographyProps}
      component={typographyProps?.component ?? 'div'}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Avoid extra <p> wrappers; let outer Typography control layout
          p: ({ children }) => <>{children}</>
        }}
      >
        {normalized}
      </ReactMarkdown>
    </Typography>
  );
}

export default ClusterLabel;



