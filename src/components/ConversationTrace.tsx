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
 */
function highlightContent(text: string, highlights?: string[]): Array<string | React.ReactNode> {
  if (!highlights || highlights.length === 0) return [text];

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

  if (matches.length === 0) return [text];

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

    // Add highlighted match
    result.push(
      <mark
        key={`${match.start}-${i}`}
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

  return result;
}

// Recursively apply highlighting to React children
function applyHighlightToChildren(children: React.ReactNode, highlights?: string[]): React.ReactNode {
  if (!highlights || highlights.length === 0) return children;

  if (typeof children === 'string') {
    return highlightContent(children, highlights);
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{applyHighlightToChildren(child, highlights)}</React.Fragment>
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

export function ConversationTrace({ messages, highlights, rawResponse }: { messages: Message[]; highlights?: string[]; rawResponse?: any }) {
  const [prettyPrintEnabled, setPrettyPrintEnabled] = useState(true);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  console.log('[ConversationTrace] Rendering with highlights:', highlights);

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
              {/* Role label and controls */}
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: isCollapsed ? 0 : 0.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600, color: dotColor, textTransform: 'capitalize' }}>
                    {m.role}
                    {m.name && `: ${m.name}`}
                    {isCollapsed && ' (collapsed)'}
                  </Typography>
                </Stack>
                {!isCollapsed && hasJsonContent && (
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
                        fontSize: '0.7rem',
                        color: 'text.secondary'
                      }
                    }}
                  />
                )}
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

            {content && content.trim() && (() => {
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
                  {highlights && highlights.length > 0 ? highlightContent(content, highlights) : content}
                </Typography>
              );
            }

            const hasMarkdown = /[#*`_\[\](){}]|^\s*[-+*]\s|^\s*\d+\.\s/m.test(content);
            // Only detect LaTeX if it has $$ or \commands, not single $ followed by numbers (to avoid treating $255 as LaTeX)
            const hasLaTeX = /\$\$[^$]*\$\$|\\[a-zA-Z]+\{|\\\\\(|\\\\\[/.test(content);

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
                    '& .katex': { fontSize: '1em' },
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
                      p: ({ children }) => <p style={{ margin: '4px 0' }}>{applyHighlightToChildren(children, highlights)}</p>,
                      span: ({ children }) => <span>{applyHighlightToChildren(children, highlights)}</span>,
                      li: ({ children }) => <li>{applyHighlightToChildren(children, highlights)}</li>,
                      strong: ({ children }) => <strong>{applyHighlightToChildren(children, highlights)}</strong>,
                      em: ({ children }) => <em>{applyHighlightToChildren(children, highlights)}</em>,
                      h1: ({ children }) => <h1>{applyHighlightToChildren(children, highlights)}</h1>,
                      h2: ({ children }) => <h2>{applyHighlightToChildren(children, highlights)}</h2>,
                      h3: ({ children }) => <h3>{applyHighlightToChildren(children, highlights)}</h3>,
                      h4: ({ children }) => <h4>{applyHighlightToChildren(children, highlights)}</h4>,
                      h5: ({ children }) => <h5>{applyHighlightToChildren(children, highlights)}</h5>,
                      h6: ({ children }) => <h6>{applyHighlightToChildren(children, highlights)}</h6>,
                    }}
                  >
                    {content}
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
                {highlights && highlights.length > 0 ? highlightContent(content, highlights) : content}
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


