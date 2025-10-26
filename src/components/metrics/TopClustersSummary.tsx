import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import type { ModelClusterRow, MetricsFilters } from '../../types/metrics';

interface TopClustersSummaryProps {
  data: ModelClusterRow[];
  filters: MetricsFilters;
  onNavigateToCluster?: (clusterName: string) => void;
}

function formatDeltaPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function getGroupColor(groupRaw?: unknown): string {
  const group = String(groupRaw || '').trim().toLowerCase();
  if (!group) return '#9E9E9E';
  if (group === 'negative (critical)' || group === 'negative critical') return '#DC2626';
  if (group === 'negative (non-critical)' || group === 'negative non-critical' || group === 'negative (non critical)') return '#CA8A04';
  if (group === 'positive') return '#16A34A';
  if (group === 'style') return '#9C27B0';
  return '#9E9E9E';
}

type LocalSortOption =
  | 'proportion_delta_desc'
  | 'proportion_delta_asc'
  | 'proportion_desc'
  | 'proportion_asc';

export function TopClustersSummary({ data, filters, onNavigateToCluster }: TopClustersSummaryProps) {
  const [sortOption, setSortOption] = useState<LocalSortOption>('proportion_delta_desc');

  const grouped = useMemo(() => {
    const filtered = data.filter(row =>
      (filters.selectedModels.length === 0 || filters.selectedModels.includes(row.model))
    );

    const byModel = filtered.reduce((acc, row) => {
      if (!acc[row.model]) acc[row.model] = [] as ModelClusterRow[];
      acc[row.model].push(row);
      return acc;
    }, {} as Record<string, ModelClusterRow[]>);

    const perModel = Object.entries(byModel).map(([model, rows]) => {
      let rowsToUse = rows;
      if (filters.significanceOnly) {
        const qSigKey = `quality_delta_${filters.qualityMetric}_significant` as keyof ModelClusterRow;
        rowsToUse = rows.filter(r => r.proportion_delta_significant === true || (r[qSigKey] as unknown as boolean) === true);
      }
      const sorted = rowsToUse.slice().sort((a, b) => {
        switch (sortOption) {
          case 'proportion_asc':
            return (a.proportion || 0) - (b.proportion || 0);
          case 'proportion_desc':
            return (b.proportion || 0) - (a.proportion || 0);
          case 'proportion_delta_asc':
            return (a.proportion_delta || 0) - (b.proportion_delta || 0);
          case 'proportion_delta_desc':
          default:
            return (b.proportion_delta || 0) - (a.proportion_delta || 0);
        }
      }).slice(0, Math.max(1, filters.topN || 5));
      return { model, rows: sorted };
    }).filter(m => m.rows.length > 0);

    return perModel;
  }, [data, filters, sortOption]);

  if (grouped.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Top Clusters by Model
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No clusters match current filters.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">
          Top Clusters by Model
        </Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            label="Sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as LocalSortOption)}
          >
            <MenuItem value="proportion_delta_desc">Δfrequency (High → Low)</MenuItem>
            <MenuItem value="proportion_delta_asc">Δfrequency (Low → High)</MenuItem>
            <MenuItem value="proportion_desc">Frequency (High → Low)</MenuItem>
            <MenuItem value="proportion_asc">Frequency (Low → High)</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Hover to see hint; click to inspect cluster and examples
      </Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {grouped.map(({ model, rows }) => (
          <Paper key={model} elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }} title={model}>
              {(model.split('/').pop() || model)}
            </Typography>
            <List dense disablePadding>
              {rows.map((row) => {
                const delta = row.proportion_delta || 0;
                const deltaColor = delta > 0 ? 'success.main' : (delta < 0 ? 'error.main' : 'text.secondary');
                const proportion = Math.max(0, Math.min(1, row.proportion || 0));
                const fillPercent = Math.max(0.06, proportion) * 100;
                const tagName = String(row.metadata?.group || '').trim();
                const tagColor = getGroupColor(tagName);
                const hasExamples = Array.isArray(row.examples) && row.examples.length > 0;
                return (
                  <Tooltip key={`${row.model}-${row.cluster}`} title={hasExamples ? 'Click to inspect cluster and examples' : 'Click to inspect cluster'} placement="top-start">
                    <ListItemButton
                      onClick={() => onNavigateToCluster?.(row.cluster)}
                      sx={{
                        borderRadius: 1,
                        alignItems: 'flex-start',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                            <Box sx={{ width: 105, mr: 1 }}>
                              <Tooltip title={`Frequency: ${(proportion * 100).toFixed(1)}% · Δ: ${formatDeltaPercent(delta)}`} placement="top">
                                <Box sx={{ width: '100%', height: 8, borderRadius: 4, bgcolor: 'action.hover' }}>
                                  <Box sx={{ width: `${fillPercent}%`, height: '100%', borderRadius: 4, bgcolor: 'text.secondary' }} />
                                </Box>
                              </Tooltip>
                              <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">{(proportion * 100).toFixed(1)}%</Typography>
                                <Typography variant="caption" sx={{ color: deltaColor }}>{formatDeltaPercent(delta)}</Typography>
                              </Stack>
                            </Box>
                            <Box component="span" sx={{ flex: 1, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                              {row.cluster}
                              {tagName && (
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: tagColor }}>
                                  ({tagName})
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        }
                      />
                      <ArrowRightAltIcon fontSize="small" color="action" />
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </List>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

export default TopClustersSummary;
