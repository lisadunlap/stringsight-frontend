/**
 * MetricsOverviewBanner - Quick statistics banner displayed at the top of the metrics page.
 *
 * Shows:
 * 1. Cluster counts by group (negative critical, negative non-critical, stylistic - excludes positive)
 * 2. Number of misaligned metrics (unique metrics that are misaligned, not per-behavior)
 */

import { Box, Paper, Stack, Typography, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { ModelClusterRow } from '../../types/metrics';

interface MetricsOverviewBannerProps {
  data: ModelClusterRow[];
  qualityMetrics: string[];
  onNavigateToMisalignedSection?: () => void;
}

// Normalize group values to standard categories
function normalizeGroup(group: string | undefined): string | null {
  if (!group) return null;
  const v = group.toLowerCase().trim().replace(/[_\s]+/g, '_');

  if (v === 'negative_(critical)' || v === 'negative_critical' || v === 'negative (critical)') return 'negative_critical';
  if (v === 'negative_(non-critical)' || v === 'negative_non-critical' || v === 'negative_non_critical' || v === 'negative (non-critical)') return 'negative_non_critical';
  if (v === 'positive') return 'positive';
  if (v === 'style' || v === 'stylistic') return 'style';

  return null;
}

function getGroupColor(group: string): string {
  switch (group) {
    case 'positive': return '#16A34A'; // green
    case 'negative_critical': return '#DC2626'; // red
    case 'negative_non_critical': return '#CA8A04'; // yellow/amber
    case 'style': return '#6366F1'; // blue/indigo
    default: return '#6B7280'; // gray
  }
}

function getGroupLabel(group: string): string {
  switch (group) {
    case 'positive': return 'Positive';
    case 'negative_critical': return 'Negative (critical)';
    case 'negative_non_critical': return 'Negative (non-critical)';
    case 'style': return 'Stylistic';
    default: return group;
  }
}

export function MetricsOverviewBanner({ data, qualityMetrics, onNavigateToMisalignedSection }: MetricsOverviewBannerProps) {
  const stats = useMemo(() => {
    // Count unique clusters by group
    const clustersByGroup = new Map<string, Set<string>>();

    // Track which metrics are misaligned (across all behaviors)
    const misalignedMetrics = new Set<string>();

    data.forEach(row => {
      const group = normalizeGroup(row.metadata?.group);

      // Count clusters by group
      if (group) {
        if (!clustersByGroup.has(group)) {
          clustersByGroup.set(group, new Set());
        }
        clustersByGroup.get(group)!.add(row.cluster);
      }

      // Check if this cluster significantly affects quality for any metric
      qualityMetrics.forEach(metric => {
        const qualitySigKey = `quality_delta_${metric}_significant`;
        const isSignificant = row[qualitySigKey as keyof typeof row];

        // Check for misalignment:
        // - Negative behaviors with positive quality delta
        // - Stylistic behaviors with any quality delta
        const isNegative = group === 'negative_critical' || group === 'negative_non_critical';
        const isStylistic = group === 'style';

        if (isSignificant && (isNegative || isStylistic)) {
          const qualityDeltaKey = `quality_delta_${metric}`;
          const qualityDelta = row[qualityDeltaKey as keyof typeof row] as number;

          if (qualityDelta !== undefined && qualityDelta !== null) {
            // For negative: misaligned if delta > 0 (positive impact)
            // For stylistic: misaligned if any significant delta exists
            if ((isNegative && qualityDelta > 0) || (isStylistic && qualityDelta !== 0)) {
              misalignedMetrics.add(metric);
            }
          }
        }
      });
    });

    // Convert group counts to sorted array (excluding positive)
    const groupCounts = Array.from(clustersByGroup.entries())
      .filter(([group]) => group !== 'positive') // Exclude positive clusters
      .map(([group, clusters]) => ({
        group,
        count: clusters.size,
        color: getGroupColor(group),
        label: getGroupLabel(group)
      }))
      .sort((a, b) => {
        // Sort order: negative_critical, negative_non_critical, style
        const order = ['negative_critical', 'negative_non_critical', 'style'];
        return order.indexOf(a.group) - order.indexOf(b.group);
      });

    return {
      groupCounts,
      misalignedMetrics: misalignedMetrics.size
    };
  }, [data, qualityMetrics]);

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        p: 2.5,
        mb: 1.5,
        bgcolor: '#ffffff',
        borderRadius: 2,
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(white, white), linear-gradient(90deg, #2563eb, #10b981)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        // Match Properties overview banner: no strong drop shadow on the metrics banner
        boxShadow: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'flex-start',
        justifyContent: 'space-between'
      }}
    >
      {/* Cluster counts by group */}
      <Box>
        <Typography variant="caption" sx={{ mb: 1, display: 'block', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
          Clusters by Type
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {stats.groupCounts.map(({ group, count, color, label }) => (
            <Chip
              key={group}
              label={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>
                    {count}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 600, color: color }}>
                    {label}
                  </Typography>
                </Box>
              }
              size="medium"
              sx={{
                bgcolor: `${color}15`,
                height: 'auto',
                py: 0.75,
                px: 1.25,
                border: 'none',
                '& .MuiChip-label': {
                  px: 0
                }
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Misaligned metrics */}
      <Box sx={{ minWidth: 200 }}>
        <Typography variant="caption" sx={{ mb: 1, display: 'block', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
          Misalignment
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography component="span" sx={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: stats.misalignedMetrics > 0 ? '#EF4444' : '#10B981'
                }}>
                  {stats.misalignedMetrics}
                </Typography>
                <Typography component="span" sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: stats.misalignedMetrics > 0 ? '#EF4444' : '#10B981'
                }}>
                  metric{stats.misalignedMetrics !== 1 ? 's' : ''}
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: stats.misalignedMetrics > 0 ? '#EF444415' : '#10B98115',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': {
                px: 0
              },
              cursor: 'default'
            }}
          />
          <Typography variant="caption" sx={{ color: '#111827' }}>
            misaligned
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default MetricsOverviewBanner;
