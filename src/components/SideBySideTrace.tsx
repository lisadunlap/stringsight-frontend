import React from "react";
import type { Message } from "../lib/traces";
import { Box, Typography } from "@mui/material";
import ConversationTrace from "./ConversationTrace";

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
}) {
  return (
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
  );
}

export default SideBySideTrace;


