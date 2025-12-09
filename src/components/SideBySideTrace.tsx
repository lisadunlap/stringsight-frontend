import React from "react";
import type { Message } from "../lib/traces";
import { Box, Typography } from "@mui/material";
import ConversationTrace from "./ConversationTrace";

/**
 * SideBySideTrace
 *
 * Renders two conversation traces side by side, along with optional per-model score
 * dictionaries and a high-level winner indicator for the comparison.
 *
 * - `messagesA` / `messagesB`: arrays of messages for model A/B.
 * - `modelA` / `modelB`: model identifier strings (e.g., 'gpt-4', 'claude-3').
 * - `scoreA` / `scoreB`: optional score dictionaries keyed by metric name with numeric values.
 * - `winner`: optional string indicating the outcome of the comparison:
 *   - model name (e.g. 'gpt-4', 'model_a', 'model_b') when that model wins
 *   - a string containing 'tie' (case-insensitive) for tied outcomes.
 */
export function SideBySideTrace({
  messagesA,
  messagesB,
  modelA,
  modelB,
  highlights,
  targetModel,
  rawResponseA,
  rawResponseB,
  scoreA,
  scoreB,
  winner,
}: {
  messagesA: Message[];
  messagesB: Message[];
  modelA: string;
  modelB: string;
  highlights?: string[];
  targetModel?: string;
  rawResponseA?: any;
  rawResponseB?: any;
  scoreA?: Record<string, any>;
  scoreB?: Record<string, any>;
  /**
   * Winner string for the comparison.
   *
   * Expected formats:
   * - Exact model name (e.g. 'gpt-4', 'claude-3', 'model_a', 'model_b') when that model wins.
   * - A string containing 'tie' (any casing) to indicate a tie.
   */
  winner?: string;
}) {
  const renderWinnerLabel = (value?: string) => {
    if (!value || typeof value !== 'string') return null;
    const lower = value.toLowerCase();
    const isTie = lower.includes('tie');
    const label = isTie ? 'Tie' : `Winner: ${value}`;
    return (
      <Typography
        variant="caption"
        sx={{ display: 'block', mb: 1.5, fontWeight: 600, textAlign: 'center' }}
      >
        {label}
      </Typography>
    );
  };

  return (
    <Box>
      {renderWinnerLabel(winner)}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2,
      }}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2">
            {modelA}
          </Typography>
          {scoreA && Object.keys(scoreA).length > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              {Object.entries(scoreA).map(([key, value]) => (
                <Typography key={key} variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                  {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
        <ConversationTrace messages={messagesA} highlights={targetModel && targetModel !== modelA ? [] : highlights} rawResponse={rawResponseA} />
      </Box>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2">
            {modelB}
          </Typography>
          {scoreB && Object.keys(scoreB).length > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              {Object.entries(scoreB).map(([key, value]) => (
                <Typography key={key} variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                  {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
        <ConversationTrace messages={messagesB} highlights={targetModel && targetModel !== modelB ? [] : highlights} rawResponse={rawResponseB} />
      </Box>
      </Box>
    </Box>
  );
}

export default SideBySideTrace;


