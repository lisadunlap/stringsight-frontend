/**
 * TagChips - Cluster metadata tags display.
 * 
 * Renders metadata fields as small chips with subtle styling.
 * Common fields: group, tag, category, etc.
 */

import React from 'react';
import {
  Chip,
  Stack
} from '@mui/material';

interface TagChipsProps {
  metadata: Record<string, any>;
  maxTags?: number;
}

export function TagChips({
  metadata,
  maxTags = 3
}: TagChipsProps) {
  
  // Extract meaningful tags from metadata
  const tagFields = ['group', 'tag', 'category', 'type', 'style'];
  const tags: string[] = [];
  
  for (const field of tagFields) {
    const value = metadata[field];
    if (value && typeof value === 'string' && value.trim()) {
      tags.push(value.trim());
    }
  }
  
  // Remove duplicates and limit count
  const uniqueTags = [...new Set(tags)].slice(0, maxTags);
  
  if (uniqueTags.length === 0) {
    return null;
  }

  const colorForTag = (label: string) => {
    const norm = label.trim().toLowerCase();
    if (norm === 'style') {
      return { text: '#9C27B0', bg: '#F3E5F5', border: '#E1BEE7' }; // Purple
    }
    if (norm === 'positive') {
      return { text: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' }; // Green
    }
    if (norm === 'negative (non-critical)' || norm === 'negative non-critical' || norm === 'negative (non critical)') {
      return { text: '#CA8A04', bg: '#FEF9C3', border: '#FDE047' }; // Yellow
    }
    if (norm === 'negative (critical)' || norm === 'negative critical') {
      return { text: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }; // Red
    }
    // default - grey for any other groups
    return { text: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' }; // Grey
  };

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {uniqueTags.map((tag, index) => {
        const c = colorForTag(tag);
        return (
          <Chip
            key={index}
            label={tag}
            size="small"
            variant="outlined"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              color: c.text,
              borderColor: c.border,
              backgroundColor: c.bg,
              '& .MuiChip-label': {
                px: 0.75
              }
            }}
          />
        );
      })}
    </Stack>
  );
}

export default TagChips;
