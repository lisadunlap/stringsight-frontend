/**
 * ModelComparisonTab - Displays model comparison cards showing all behaviors
 * (ignoring behavior-type filters) with positive frequency delta (>5%) for each model.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Chip,
  Slider
} from '@mui/material';
import type { ModelClusterRow, MetricsFilters } from '../../types/metrics';
import { ClusterLabel } from '../ClusterLabel';

// Model color palette (matches FrequencyChartAlt)
const MODEL_COLORS = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA'];

function getModelColor(model: string, allModels: string[]): string {
  const index = allModels.indexOf(model);
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

// Normalize group names to standard categories
function normalizeGroup(value: unknown): string {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'negative (critical)' || v === 'negative critical') return 'negative_critical';
  if (v === 'negative (non-critical)' || v === 'negative non-critical' || v === 'negative (non critical)') return 'negative_non_critical';
  if (v === 'positive') return 'positive';
  if (v === 'style') return 'style';
  return v;
}

interface ModelCardBehavior {
  cluster: string;
  category: string;
  proportion: number;
  proportionDelta: number;
  size: number;
}

interface ModelCard {
  model: string;
  behaviors: ModelCardBehavior[];
}

interface ModelComparisonTabProps {
  data: ModelClusterRow[];
  filters: MetricsFilters;
  onNavigateToCluster?: (clusterName: string) => void;
}

export function ModelComparisonTab({
  data,
  filters,
  onNavigateToCluster
}: ModelComparisonTabProps) {
  const [minDelta, setMinDelta] = useState<number>(0.05);

  const modelCards = useMemo(() => {
    // Get all unique models from the data (before filtering)
    const allModels = data.length > 0
      ? [...new Set(data.map(row => row.model))].sort()
      : [];

    if (!data.length) {
      return { cards: [], allModels };
    }

    // Apply model filter
    const filteredData = filters.selectedModels.length > 0
      ? data.filter(row => filters.selectedModels.includes(row.model))
      : data;

    // MODEL CARDS - Show all behaviors (ignore behavior-type filter) with positive frequency delta per model
    const modelCardsMap = new Map<string, ModelCardBehavior[]>();

    filteredData.forEach(row => {
      const group = normalizeGroup(row.metadata?.group);

      // Must have positive frequency delta
      const proportionDelta = row.proportion_delta || 0;
      if (proportionDelta <= 0) return;

      // Must exceed threshold
      if (proportionDelta <= minDelta) return;

      // // Must be significant
      // if (row.proportion_delta_significant !== true) return;

      if (!modelCardsMap.has(row.model)) {
        modelCardsMap.set(row.model, []);
      }

      modelCardsMap.get(row.model)!.push({
        cluster: row.cluster,
        category: group,
        proportion: row.proportion || 0,
        proportionDelta,
        size: row.size || 0
      });
    });

    // Convert to array and sort behaviors by delta (descending)
    const cards: ModelCard[] = Array.from(modelCardsMap.entries())
      .map(([model, behaviors]) => ({
        model,
        behaviors: behaviors.sort((a, b) => b.proportionDelta - a.proportionDelta)
      }))
      .filter(card => card.behaviors.length > 0)
      .sort((a, b) => a.model.localeCompare(b.model));

    return { cards, allModels };
  }, [data, filters, minDelta]);

  const shortModelName = (model: string) => model.split('/').pop() || model;

  if (!data.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No data available
        </Typography>
      </Box>
    );
  }

  // Convert hex to rgba with low opacity for light background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
            Model Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Patterns where this model shows up noticeably more often than others (more than {(minDelta * 100).toFixed(1)} percentage points higher).
          </Typography>
        </Box>
        <Box sx={{ width: 200, mr: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Threshold: {(minDelta * 100).toFixed(1)}%
          </Typography>
          <Slider
            value={minDelta}
            onChange={(_, value) => setMinDelta(value as number)}
            min={0}
            max={0.20}
            step={0.005}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${(v * 100).toFixed(1)}%`}
            size="small"
          />
        </Box>
      </Box>

      {modelCards.cards.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No model comparison data found. Behaviors matching the selected types with positive frequency delta (&gt;{(minDelta * 100).toFixed(1)}%) will appear here.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2
          }}
        >
          {modelCards.cards.map((card) => {
            const modelColor = getModelColor(card.model, modelCards.allModels);
            return (
              <Paper
                key={card.model}
                elevation={2}
                sx={{
                  p: 2,
                  bgcolor: hexToRgba(modelColor, 0.05),
                  border: '1px solid',
                  borderColor: modelColor,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    mb: 1.5,
                    fontWeight: 600,
                    color: modelColor,
                    fontSize: '1rem',
                    flexShrink: 0
                  }}
                >
                  {shortModelName(card.model)}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 1,
                    '&::-webkit-scrollbar': {
                      width: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                      bgcolor: 'grey.100',
                      borderRadius: '4px'
                    },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: 'grey.400',
                      borderRadius: '4px',
                      '&:hover': {
                        bgcolor: 'grey.500'
                      }
                    }
                  }}
                >
                  <Stack spacing={1}>
                    {card.behaviors.map((behavior, idx) => {
                      const categoryConfig: Record<string, { label: string; color: string }> = {
                        negative_critical: { label: 'Critical', color: '#DC2626' },
                        negative_non_critical: { label: 'Non-critical', color: '#CA8A04' },
                        style: { label: 'Style', color: '#9C27B0' },
                        positive: { label: 'Positive', color: '#16A34A' }
                      };
                      const config = categoryConfig[behavior.category] || { label: behavior.category, color: '#9E9E9E' };
                      const hasCategory = behavior.category && behavior.category.trim() !== '';

                      return (
                        <Box
                          key={idx}
                          onClick={() => onNavigateToCluster?.(behavior.cluster)}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            cursor: 'pointer',
                            '&:hover': {
                              borderColor: modelColor
                            },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <ClusterLabel
                            text={behavior.cluster}
                            typographyProps={{
                              variant: 'body2',
                              sx: {
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                whiteSpace: 'normal',
                                mb: 0.5
                              }
                            }}
                          />
                          <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Frequency: {(behavior.proportion * 100).toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>
                              Δ: +{(behavior.proportionDelta * 100).toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {behavior.size} conversations
                            </Typography>
                            {hasCategory && (
                              <Chip
                                label={config.label}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  color: config.color,
                                  borderColor: config.color,
                                  bgcolor: 'background.paper',
                                  fontWeight: 500,
                                  flexShrink: 0
                                }}
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default ModelComparisonTab;

