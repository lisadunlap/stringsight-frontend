import React from 'react';
import { Box, Typography, Stack, Chip, Divider } from '@mui/material';

interface PropertyTraceHeaderProps {
  selectedRow: any;
  selectedProperty: any;
  method: 'single_model' | 'side_by_side' | 'unknown';
  evidenceTargetModel?: string;
}

export default function PropertyTraceHeader({
  selectedRow,
  selectedProperty,
  method,
  evidenceTargetModel
}: PropertyTraceHeaderProps) {
  

  // Separate metadata into chips vs full-text sections
  const getCategoryChips = () => {
    if (!selectedProperty) return [];
    const chipFields = ['category', 'behavior_type', 'contains_errors', 'unexpected_behavior'];
    return Object.entries(selectedProperty)
      .filter(([key]) => chipFields.includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

  const getFullTextSections = () => {
    if (!selectedProperty) return [];
    const textFields = ['reason', 'evidence'];
    return Object.entries(selectedProperty)
      .filter(([key]) => textFields.some(f => key.toLowerCase().includes(f)))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

  // Format property metadata
  const formatPropertyValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;

    // Handle booleans
    if (typeof value === 'boolean') {
      return (
        <Chip
          key={key}
          label={`${key.replace(/_/g, ' ')}: ${value ? 'True' : 'False'}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    // Handle behavior_type with specific colors
    if (key === 'behavior_type') {
      const valueStr = String(value);
      let chipBgColor = '#6b7280'; // Default grey

      if (valueStr === 'Style') {
        chipBgColor = '#a855f7'; // Purple
      } else if (valueStr === 'Negative (non-critical)') {
        chipBgColor = '#f97316'; // Orange
      } else if (valueStr === 'Negative (critical)') {
        chipBgColor = '#ef4444'; // Red
      } else if (valueStr === 'Positive') {
        chipBgColor = '#22c55e'; // Green
      }

      return (
        <Chip
          key={key}
          label={`${key.replace(/_/g, ' ')}: ${valueStr}`}
          size="small"
          sx={{
            fontSize: '0.7rem',
            backgroundColor: chipBgColor,
            color: '#ffffff',
            fontWeight: 500,
            border: 'none'
          }}
        />
      );
    }

    // Handle strings and numbers as chips
    return (
      <Chip
        key={key}
        label={`${key.replace(/_/g, ' ')}: ${String(value)}`}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.7rem' }}
      />
    );
  };

  const formatFullTextSection = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;

    let displayValue = '';

    // Handle arrays (like evidence)
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      displayValue = value.map(v => `"${v}"`).join('\n');
    } else {
      displayValue = String(value);
    }

    return (
      <Box key={key} sx={{ mb: 1, width: '100%' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', display: 'block', mb: 0.25 }}>
          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
        </Typography>
        <Typography variant="body2" sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#334155'
        }}>
          {displayValue}
        </Typography>
      </Box>
    );
  };

  // Get conversation scores
  const getConversationScores = () => {
    let entries: [string, any][] = [];
    if (method === 'single_model') {
      const scores = selectedRow?.score || null;
      entries = scores && typeof scores === 'object' ? Object.entries(scores as Record<string, number>) : [];
    } else if (method === 'side_by_side') {
      const isA = evidenceTargetModel && String(selectedRow?.model_a || '') === String(evidenceTargetModel);
      const isB = evidenceTargetModel && String(selectedRow?.model_b || '') === String(evidenceTargetModel);
      const sa = (selectedRow as any)?.score_a || {};
      const sb = (selectedRow as any)?.score_b || {};
      const chosen = isA ? sa : isB ? sb : sa; // default A
      entries = Object.entries(chosen);
    }
    return entries;
  };

  // Get property metadata (excluding certain fields)
  const getPropertyMetadata = () => {
    if (!selectedProperty) return [];
    
    const excludeKeys = new Set([
      'question_id', 'model', 'model_response', 'property_description', 
      '__index', 'row_index', 'id', 'meta', 'raw_response'
    ]);
    
    return Object.entries(selectedProperty)
      .filter(([key]) => !excludeKeys.has(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

  const categoryChips = getCategoryChips();
  const fullTextSections = getFullTextSections();

  return (
    <Box sx={{ mb: 2 }}>
      {/* Property Information */}
      <Box>
        <Typography variant="subtitle2" sx={{ color: '#334155', mb: 1 }}>
          Property Information
        </Typography>

        {/* Property Description */}
        {selectedProperty?.property_description && (
          <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic', color: '#64748B' }}>
            "{selectedProperty.property_description}"
          </Typography>
        )}

        {/* Category Chips (inline, wrapped) */}
        {categoryChips.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {categoryChips.map(([key, value]) => formatPropertyValue(key, value))}
          </Stack>
        )}

        {/* Full Text Sections (Reason, Evidence) */}
        {fullTextSections.map(([key, value]) => formatFullTextSection(key, value))}
      </Box>
    </Box>
  );
}
