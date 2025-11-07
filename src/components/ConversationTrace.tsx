import React, { useState, useRef } from "react";
import type { Message } from "../lib/traces";
import { Box, Typography, Chip, Stack, Accordion, AccordionSummary, AccordionDetails, FormControlLabel, Switch } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Normalize LaTeX delimiters to formats supported by remark-math
// Convert \[...\] to $$...$$ and \(...\) to $...$
function normalizeLatexDelimiters(text: string): string {
  // Replace \[...\] with $$...$$ (display math)
  // In replacement strings, $$ = one $, so $$$$$1$$$$ = $$ + content + $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  // Replace \(...\) with $...$ (inline math)
  // $$$1$$ = $ + content + $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  return text;
}

// Helper to extract text content from various content formats
function getTextContent(content: any): string {
  if (typeof content === 'string') {
    // Try to parse and pretty-print if it's a stringified dict/object
    const trimmed = content.trim();
    const looksJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    if (looksJson) {
      try {
        // Try standard JSON parsing
        const parsed = JSON.parse(trimmed);
        if (parsed && (typeof parsed === 'object')) {
          return JSON.stringify(parsed, null, 2);
        }
      } catch (_e) {
        // Try Python-style dict/list strings
        try {
          let pythonToJson = trimmed;
          // Replace Python literals
          pythonToJson = pythonToJson
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null');
          // Replace single quotes with double quotes
          pythonToJson = pythonToJson.replace(/'/g, '"');
          const parsed = JSON.parse(pythonToJson);
          if (parsed && (typeof parsed === 'object')) {
            return JSON.stringify(parsed, null, 2);
          }
        } catch (_e2) {
          // Both parsing attempts failed, return original
        }
      }
    }
    return content;
  }
  if (typeof content === 'object' && content !== null) {
    // Extract text from nested object and recursively process it
    if (content.text) return getTextContent(String(content.text));
    if (content.content) return getTextContent(String(content.content));
    return JSON.stringify(content, null, 2);
  }
  return String(content ?? '');
}

// Content blocks used for rendering mixed text and images
type ContentBlock = { kind: 'text'; text: string } | { kind: 'image'; url: string };

/**
 * Normalize assorted message content shapes into ordered blocks of text and images.
 * Supported inputs:
 * - string: returns one text block
 * - object with text/content/image/image_url
 * - OpenAI-style array: [{type: 'text', text: string}, {type: 'image_url', image_url: {url: string} | string}, ...]
 * - object containing content: Array<...> (same shapes as above)
 */
function getContentBlocks(content: any): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Helper to push image URL if present and string-like
  const pushImage = (maybeUrl: any) => {
    if (!maybeUrl) return;
    if (typeof maybeUrl === 'string') {
      blocks.push({ kind: 'image', url: maybeUrl });
      return;
    }
    if (typeof maybeUrl === 'object' && maybeUrl !== null && typeof maybeUrl.url === 'string') {
      blocks.push({ kind: 'image', url: maybeUrl.url });
    }
  };

  // Helper to push text if present and string-like
  const pushText = (maybeText: any) => {
    if (typeof maybeText === 'string' && maybeText.trim().length > 0) {
      blocks.push({ kind: 'text', text: maybeText });
    }
  };

  // string content → try to parse JSON, else single text block
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return getContentBlocks(parsed);
      } catch (_e) {
        // fallthrough
      }
    }
    pushText(content);
    return blocks;
  }
  
  // array content → iterate OpenAI-style parts
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === 'object') {
        if (part.type === 'text') {
          pushText(part.text);
        } else if (part.type === 'image_url') {
          pushImage(part.image_url);
        } else if (typeof part.text === 'string') {
          pushText(part.text);
        } else if (part.image || part.image_url) {
          pushImage(part.image ?? part.image_url);
        }
      } else if (typeof part === 'string') {
        pushText(part);
      }
    }
    return blocks;
  }

  // object content
  if (typeof content === 'object' && content !== null) {
    // If it contains a nested content array, normalize that
    if (Array.isArray((content as any).content)) {
      return getContentBlocks((content as any).content);
    }

    // image fields
    if ((content as any).image || (content as any).image_url) {
      pushImage((content as any).image ?? (content as any).image_url);
    }

    // text-like fields (attempt JSON parse if they look like JSON)
    if (typeof (content as any).text === 'string') {
      const t = (content as any).text as string;
      const trimmed = t.trim();
      if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return getContentBlocks(parsed);
        } catch (_e) {
          // keep as text
        }
      }
      pushText(t);
    } else if (typeof (content as any).content === 'string') {
      const t = (content as any).content as string;
      const trimmed = t.trim();
      if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return getContentBlocks(parsed);
        } catch (_e) {
          // keep as text
        }
      }
      pushText(t);
    } else {
      // Fallback: stringify object as text if no explicit fields found
      try {
        const asText = getTextContent(content);
        if (asText && asText.trim().length > 0) pushText(asText);
      } catch (_e) {
        // ignore
      }
    }

    return blocks;
  }

  // final fallback
  pushText(String(content ?? ''));
  return blocks;
}

/**
 * Normalize text for fuzzy matching:
 * - Collapse multiple whitespace to single space
 * - Normalize quote and dash variations
 * - Lowercase for comparison
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .replace(/[''']/g, "'")  // Normalize quotes
    .replace(/["""]/g, '"')
    .replace(/[—–-]/g, '-')  // Normalize dashes
    .trim();
}

/**
 * Calculate word overlap score (Jaccard similarity)
 */
function calculateWordOverlap(words1: string[], words2: string[]): number {
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Map character position in normalized text back to original text
 */
function mapNormalizedToOriginal(
  original: string,
  normalizedStart: number,
  normalizedLength: number
): { start: number; end: number } | null {
  const normalized = normalizeForMatching(original);
  let normIdx = 0;
  let origIdx = 0;
  let foundStart = -1;
  let foundEnd = -1;

  while (origIdx < original.length && normIdx < normalized.length) {
    const origChar = normalizeForMatching(original[origIdx]);
    const normChar = normalized[normIdx];

    if (origChar === normChar) {
      if (normIdx === normalizedStart) {
        foundStart = origIdx;
      }
      if (normIdx === normalizedStart + normalizedLength - 1) {
        foundEnd = origIdx + 1;
        break;
      }
      normIdx++;
    }
    origIdx++;
  }

  if (foundStart >= 0 && foundEnd > foundStart) {
    return { start: foundStart, end: foundEnd };
  }
  return null;
}

/**
 * Find best substring match using sliding window and fuzzy matching
 */
function findBestMatch(
  haystack: string,
  needle: string,
  minSimilarity: number = 0.85
): { start: number; end: number } | null {
  const normalizedNeedle = normalizeForMatching(needle);
  const normalizedHaystack = normalizeForMatching(haystack);

  // Try exact normalized match first
  const exactIdx = normalizedHaystack.indexOf(normalizedNeedle);
  if (exactIdx !== -1) {
    return mapNormalizedToOriginal(haystack, exactIdx, normalizedNeedle.length);
  }

  // Only use fuzzy matching for longer strings (at least 20 characters)
  if (normalizedNeedle.length < 20) {
    return null;
  }

  // Fallback: sliding window with word-based fuzzy similarity
  const needleWords = normalizedNeedle.split(/\s+/).filter(w => w.length > 0);
  if (needleWords.length === 0) return null;

  const haystackWords = normalizedHaystack.split(/\s+/).filter(w => w.length > 0);
  if (haystackWords.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  // Slide window of similar size to needle
  const windowSize = Math.max(needleWords.length, Math.floor(needleWords.length * 1.5));

  for (let i = 0; i <= haystackWords.length - Math.min(needleWords.length, haystackWords.length); i++) {
    const actualWindowSize = Math.min(windowSize, haystackWords.length - i);
    const windowWords = haystackWords.slice(i, i + actualWindowSize);
    const score = calculateWordOverlap(needleWords, windowWords);

    if (score > bestScore && score >= minSimilarity) {
      bestScore = score;
      bestMatch = { windowStart: i, windowEnd: i + actualWindowSize };
    }
  }

  if (!bestMatch) return null;

  // Map word window back to character positions in normalized text
  const beforeWords = haystackWords.slice(0, bestMatch.windowStart).join(' ');
  const matchWords = haystackWords.slice(bestMatch.windowStart, bestMatch.windowEnd).join(' ');
  const normStart = beforeWords.length + (beforeWords.length > 0 ? 1 : 0);
  const normLength = matchWords.length;

  return mapNormalizedToOriginal(haystack, normStart, normLength);
}

/**
 * Merge overlapping or adjacent ranges
 */
function mergeOverlappingRanges(
  ranges: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (ranges.length === 0) return [];

  const merged: Array<{ start: number; end: number }> = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or adjacent - merge
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Improved highlighting with fuzzy matching fallback
 * Returns both the content array and whether matches were found
 */
function highlightContent(
  text: string,
  highlights?: string[],
  highlightRefsArray?: React.MutableRefObject<(HTMLElement | null)[]>
): { content: Array<string | React.ReactNode>; hasMatches: boolean } {
  if (!highlights || highlights.length === 0) return { content: [text], hasMatches: false };

  // Collect all match regions first to handle overlaps
  const matches: Array<{ start: number; end: number }> = [];

  for (const term of highlights) {
    const trimmed = String(term || '').trim();
    if (!trimmed) continue;

    // Strategy 1: Try exact match (case-insensitive but whitespace-sensitive)
    const exactPattern = escapeRegex(trimmed);
    const exactRegex = new RegExp(exactPattern, 'gi');
    let m: RegExpExecArray | null;
    let foundExact = false;

    while ((m = exactRegex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length
      });
      foundExact = true;
      if (exactRegex.lastIndex === m.index) exactRegex.lastIndex++;
    }

    // Strategy 2: Fuzzy match if no exact matches found
    if (!foundExact) {
      const fuzzyMatch = findBestMatch(text, trimmed, 0.75);
      if (fuzzyMatch) {
        matches.push(fuzzyMatch);
      }
    }
  }

  if (matches.length === 0) return { content: [text], hasMatches: false };

  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const merged = mergeOverlappingRanges(matches);

  // Build result with highlighted segments
  const result: Array<string | React.ReactNode> = [];
  let lastEnd = 0;

  for (let i = 0; i < merged.length; i++) {
    const match = merged[i];

    // Add text before match
    if (match.start > lastEnd) {
      result.push(text.slice(lastEnd, match.start));
    }

    // Add highlighted match with ref tracking
    result.push(
      <mark
        key={`${match.start}-${i}`}
        ref={(el) => {
          if (highlightRefsArray && el) {
            highlightRefsArray.current.push(el);
          }
        }}
        style={{ backgroundColor: '#FEF08A', padding: 0 }}
      >
        {text.slice(match.start, match.end)}
      </mark>
    );

    lastEnd = match.end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd));
  }

  return { content: result, hasMatches: true };
}

// Recursively apply highlighting to React children
function applyHighlightToChildren(
  children: React.ReactNode,
  highlights?: string[],
  highlightRefsArray?: React.MutableRefObject<(HTMLElement | null)[]>
): React.ReactNode {
  if (!highlights || highlights.length === 0) return children;

  if (typeof children === 'string') {
    return highlightContent(children, highlights, highlightRefsArray).content;
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{applyHighlightToChildren(child, highlights, highlightRefsArray)}</React.Fragment>
    ));
  }

  return children;
}

// Helper function to apply regex highlighting to nodes
// applyHighlightRegex is unused in the simplified version; removing to keep surface area minimal

// Helper to get role color
function getRoleDotColor(role: string) {
  if (role === "user") return "#3b82f6"; // blue
  if (role === "assistant") return "#22c55e"; // green
  if (role === "tool") return "#f97316"; // orange
  if (role === "info") return "#14b8a6"; // teal
  if (role === "system") return "#a855f7"; // purple
  return "#6b7280"; // default grey
}

export function ConversationTrace({
  messages,
  highlights,
  rawResponse,
  modelName,
  score
}: {
  messages: Message[];
  highlights?: string[];
  rawResponse?: any;
  modelName?: string;
  score?: Record<string, any>;
}) {
  const [prettyPrintEnabled, setPrettyPrintEnabled] = useState(true);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightRefs = useRef<(HTMLElement | null)[]>([]);
  const prevHighlightsRef = useRef<string[] | undefined>();

  console.log('[ConversationTrace] Rendering with highlights:', highlights);

  // Clear refs during render phase when highlights change (not in useEffect which runs after render)
  if (prevHighlightsRef.current !== highlights) {
    highlightRefs.current = [];
    prevHighlightsRef.current = highlights;
  }

  // Auto-scroll to first highlight when evidence is provided
  React.useEffect(() => {
    if (highlights && highlights.length > 0) {
      // Wait for render to complete and drawer animation, then scroll to first highlight
      const timer = setTimeout(() => {
        console.log('[ConversationTrace] Checking for highlights, refs count:', highlightRefs.current.length);
        if (highlightRefs.current.length > 0) {
          const firstHighlight = highlightRefs.current[0];
          if (firstHighlight) {
            console.log('[ConversationTrace] Auto-scrolling to first highlight');
            firstHighlight.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        } else {
          console.log('[ConversationTrace] No highlights found in rendered content');
        }
      }, 300); // Increased timeout to account for drawer animations

      return () => clearTimeout(timer);
    }
  }, [highlights]);

  const scrollToMessage = (index: number) => {
    messageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleCollapse = (index: number) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Check if any message has JSON content to determine if we should show the toggle
  const hasAnyJsonContent = messages.some((m) => {
    const content = getTextContent(m.content);
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
    return /\n\s+["{[]/.test(trimmed) || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Model name and score header */}
      {modelName && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2">
            {modelName}
          </Typography>
          {score && Object.keys(score).length > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              {Object.entries(score).map(([key, value]) => (
                <Typography key={key} variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                  {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
      {/* Pretty-print toggle at the top */}
      {hasAnyJsonContent && (
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <FormControlLabel
            control={
              <Switch
                checked={prettyPrintEnabled}
                onChange={(e) => setPrettyPrintEnabled(e.target.checked)}
                size="small"
              />
            }
            label="Pretty-print"
            sx={{
              margin: 0,
              '& .MuiFormControlLabel-label': {
                fontSize: '0.75rem',
                color: 'text.secondary'
              }
            }}
          />
        </Box>
      )}
      {/* Navigation bar */}
      {messages.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 0.5, display: 'block' }}>
            Conversation Timeline
          </Typography>
          <Box sx={{
            display: 'flex',
            gap: 0.5,
            p: 1,
            backgroundColor: '#f8fafc',
            borderRadius: 0.5,
            border: '1px solid #e5e7eb'
          }}>
          {messages.map((m, i) => {
            const color = getRoleDotColor(m.role);
            const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
            const displayName = m.name ? `${roleLabel}: ${m.name}` : roleLabel;

            return (
              <Box
                key={i}
                onClick={() => scrollToMessage(i)}
                sx={{
                  flex: 1,
                  height: 8,
                  backgroundColor: color,
                  borderRadius: 0.25,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  '&:hover': {
                    opacity: 0.8,
                    transform: 'scaleY(1.2)'
                  },
                  '&:hover::after': {
                    content: `"${displayName}"`,
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#1f2937',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10
                  }
                }}
              />
            );
          })}
          </Box>
        </Box>
      )}

      {messages.map((m, i) => {
        const isStructuredContent = typeof m.content === 'object' && m.content !== null;
        const hasToolCalls = isStructuredContent && m.content.tool_calls;
        const structuredBlocks = getContentBlocks(m.content);
        const content = prettyPrintEnabled ? getTextContent(m.content) : (
          typeof m.content === 'object' && m.content !== null
            ? (m.content.text ? String(m.content.text) : (m.content.content ? String(m.content.content) : JSON.stringify(m.content)))
            : String(m.content ?? '')
        );

        const dotColor = getRoleDotColor(m.role);
        const isToolRole = m.role === "tool";
        const isCollapsed = collapsedMessages.has(i);

        // Check if this message contains JSON-like content
        const hasJsonContent = (() => {
          const trimmed = content.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
          return /\n\s+["{[]/.test(trimmed) || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
        })();

        const isLastMessage = i === messages.length - 1;

        return (
          <Box
            key={i}
            ref={(el) => { messageRefs.current[i] = el; }}
            sx={{ position: 'relative', display: 'flex', gap: 1.5 }}
          >
            {/* Timeline dot and line */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pt: 0.5,
              minWidth: '20px'
            }}>
              {/* Dot */}
              <Box
                onClick={() => toggleCollapse(i)}
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: isToolRole ? 'transparent' : dotColor,
                  border: isToolRole ? `2px solid ${dotColor}` : 'none',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'scale(1.3)'
                  }
                }}
              />
              {/* Vertical line */}
              <Box sx={{
                width: 2,
                flex: 1,
                minHeight: 16,
                backgroundColor: dotColor,
                my: 0.5
              }} />
            </Box>

            {/* Message content */}
            <Box sx={{ flex: 1, pb: 2 }}>
              {/* Role label */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: isCollapsed ? 0 : 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: dotColor, textTransform: 'capitalize' }}>
                  {m.role}
                  {m.name && `: ${m.name}`}
                  {isCollapsed && ' (collapsed)'}
                </Typography>
              </Stack>

            {!isCollapsed && (
              <>

            {hasToolCalls && Array.isArray(m.content.tool_calls) && (
              <Box sx={{ mb: 1 }}>
                {m.content.tool_calls.map((tc: any, idx: number) => (
                  <Box key={idx} sx={{
                    mb: 0.5,
                    p: 1,
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 1
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#0369a1' }}>
                      🔧 {tc.name || 'Tool Call'}
                    </Typography>
                    {tc.arguments && (
                      <Typography variant="body2" sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        mt: 0.5,
                        color: '#475569'
                      }}>
                        {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments, null, 2)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {structuredBlocks.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 0.5 }}>
                {structuredBlocks.map((blk, idx) => {
                  if ((blk as any).kind === 'image') {
                    const b = blk as { kind: 'image'; url: string };
                    return (
                      <Box key={`img-${idx}`} sx={{ my: 0.5 }}>
                        <Box
                          component="img"
                          src={b.url}
                          alt={`image-${i}-${idx}`}
                          sx={{
                            maxWidth: '100%',
                            maxHeight: 480,
                            borderRadius: 1,
                            border: '1px solid #e5e7eb',
                            display: 'block',
                          }}
                        />
                      </Box>
                    );
                  }
                  const t = (blk as { kind: 'text'; text: string }).text ?? '';
                  if (!t.trim()) return null;

                  const isFormattedJson = (() => {
                    const trimmed = t.trim();
                    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
                    return /\n\s+["{[]/.test(trimmed);
                  })();

                  if (isFormattedJson) {
                    return (
                      <Typography key={`txt-json-${idx}`} component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.5, m: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                        {highlights && highlights.length > 0 ? highlightContent(t, highlights, highlightRefs).content : t}
                      </Typography>
                    );
                  }

                  const hasMarkdown = /[#*`_\[\](){}]|^\s*[-+*]\s|^\s*\d+\.\s/m.test(t);
                  // Detect LaTeX: $$...$$ (display math), $...$ (inline math), \[...\], \(...\), or LaTeX commands like \sum, \frac, etc.
                  // Use [\s\S] to match across newlines, and non-greedy matching with *?
                  const hasLaTeX = /\$\$[\s\S]*?\$\$|\$[^\s$][\s\S]*?[^\s$]\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\[a-zA-Z]+\{/.test(t);
                  if (hasMarkdown || hasLaTeX) {
                    return (
                      <Box key={`txt-md-${idx}`} sx={{
                        '& p': { margin: '4px 0', wordBreak: 'break-word', overflowWrap: 'anywhere' },
                        '& code': { backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'monospace', wordBreak: 'break-word' },
                        '& pre': { backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
                        '& pre code': { fontFamily: 'monospace' },
                        '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '8px 0 4px 0', fontWeight: 600, wordBreak: 'break-word' },
                        '& ul, & ol': { margin: '4px 0', paddingLeft: '20px' },
                        '& blockquote': { borderLeft: '3px solid #ddd', paddingLeft: '12px', margin: '4px 0', wordBreak: 'break-word' },
                        '& .katex, & .katex *': { fontFamily: 'KaTeX_Main, "Times New Roman", serif !important' },
                        '& .katex': { fontSize: '1.1em' },
                        '& .katex-display': { margin: '8px 0' },
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ children }) => <p style={{ margin: '4px 0' }}>{applyHighlightToChildren(children, highlights, highlightRefs)}</p>,
                            span: ({ children }) => <span>{applyHighlightToChildren(children, highlights, highlightRefs)}</span>,
                            li: ({ children }) => <li>{applyHighlightToChildren(children, highlights, highlightRefs)}</li>,
                            strong: ({ children }) => <strong>{applyHighlightToChildren(children, highlights, highlightRefs)}</strong>,
                            em: ({ children }) => <em>{applyHighlightToChildren(children, highlights, highlightRefs)}</em>,
                            h1: ({ children }) => <h1>{applyHighlightToChildren(children, highlights, highlightRefs)}</h1>,
                            h2: ({ children }) => <h2>{applyHighlightToChildren(children, highlights, highlightRefs)}</h2>,
                            h3: ({ children }) => <h3>{applyHighlightToChildren(children, highlights, highlightRefs)}</h3>,
                            h4: ({ children }) => <h4>{applyHighlightToChildren(children, highlights, highlightRefs)}</h4>,
                            h5: ({ children }) => <h5>{applyHighlightToChildren(children, highlights, highlightRefs)}</h5>,
                            h6: ({ children }) => <h6>{applyHighlightToChildren(children, highlights, highlightRefs)}</h6>,
                          }}
                        >
                          {normalizeLatexDelimiters(t)}
                        </ReactMarkdown>
                      </Box>
                    );
                  }

                  return (
                    <Typography key={`txt-${idx}`} variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {highlights && highlights.length > 0 ? highlightContent(t, highlights, highlightRefs).content : t}
                    </Typography>
                  );
                })}
              </Box>
            )}

            {structuredBlocks.length === 0 && content && content.trim() && (() => {
            // Check if content is formatted JSON first (before markdown detection)
            const isFormattedJson = (() => {
              const trimmed = content.trim();
              if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
              // Check for JSON-like indentation (multiple newlines with spaces)
              return /\n\s+["{[]/.test(trimmed);
            })();

            // If formatted JSON, render with pre-wrap to preserve formatting
            if (isFormattedJson) {
              return (
                <Typography
                  component="pre"
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    margin: 0,
                    maxWidth: '100%',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {highlights && highlights.length > 0 ? highlightContent(content, highlights, highlightRefs).content : content}
                </Typography>
              );
            }

            const hasMarkdown = /[#*`_\[\](){}]|^\s*[-+*]\s|^\s*\d+\.\s/m.test(content);
            // Detect LaTeX: $$...$$ (display math), $...$ (inline math), \[...\], \(...\), or LaTeX commands like \sum, \frac, etc.
            // Use [\s\S] to match across newlines, and non-greedy matching with *?
            const hasLaTeX = /\$\$[\s\S]*?\$\$|\$[^\s$][\s\S]*?[^\s$]\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\[a-zA-Z]+\{/.test(content);

            // Render Markdown/LaTeX if detected
            if (hasMarkdown || hasLaTeX) {
              return (
                <Box
                  sx={{
                    '& p': { margin: '4px 0', wordBreak: 'break-word', overflowWrap: 'anywhere' },
                    '& code': { backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'monospace', wordBreak: 'break-word' },
                    '& pre': { backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
                    '& pre code': { fontFamily: 'monospace' },
                    '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '8px 0 4px 0', fontWeight: 600, wordBreak: 'break-word' },
                    '& ul, & ol': { margin: '4px 0', paddingLeft: '20px' },
                    '& blockquote': { borderLeft: '3px solid #ddd', paddingLeft: '12px', margin: '4px 0', wordBreak: 'break-word' },
                    '& .katex, & .katex *': { fontFamily: 'KaTeX_Main, "Times New Roman", serif !important' },
                    '& .katex': { fontSize: '1.1em' },
                    '& .katex-display': { margin: '8px 0' },
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p style={{ margin: '4px 0' }}>{applyHighlightToChildren(children, highlights, highlightRefs)}</p>,
                      span: ({ children }) => <span>{applyHighlightToChildren(children, highlights, highlightRefs)}</span>,
                      li: ({ children }) => <li>{applyHighlightToChildren(children, highlights, highlightRefs)}</li>,
                      strong: ({ children }) => <strong>{applyHighlightToChildren(children, highlights, highlightRefs)}</strong>,
                      em: ({ children }) => <em>{applyHighlightToChildren(children, highlights, highlightRefs)}</em>,
                      h1: ({ children }) => <h1>{applyHighlightToChildren(children, highlights, highlightRefs)}</h1>,
                      h2: ({ children }) => <h2>{applyHighlightToChildren(children, highlights, highlightRefs)}</h2>,
                      h3: ({ children }) => <h3>{applyHighlightToChildren(children, highlights, highlightRefs)}</h3>,
                      h4: ({ children }) => <h4>{applyHighlightToChildren(children, highlights, highlightRefs)}</h4>,
                      h5: ({ children }) => <h5>{applyHighlightToChildren(children, highlights, highlightRefs)}</h5>,
                      h6: ({ children }) => <h6>{applyHighlightToChildren(children, highlights, highlightRefs)}</h6>,
                    }}
                  >
                    {normalizeLatexDelimiters(content)}
                  </ReactMarkdown>
                </Box>
              );
            }

            // Fallback plain text with highlighting
            return (
              <Typography variant="body2" sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}>
                {highlights && highlights.length > 0 ? highlightContent(content, highlights, highlightRefs).content : content}
              </Typography>
            );
          })()}
              </>
            )}
            </Box>
          </Box>
        );
      })}

      {/* View Raw Response Accordion */}
      {rawResponse && (
        <Accordion sx={{ mt: 1 }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: '#f8fafc',
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              View Raw Response
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                backgroundColor: '#f5f5f5',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '400px',
              }}
            >
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse, null, 2)}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default ConversationTrace;


