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
import { retroColors } from '../../theme';

interface MetricsOverviewBannerProps {
  data: ModelClusterRow[];
  qualityMetrics: string[];
  onNavigateToMisalignedSection?: () => void;
}

/**
 * Extract behavior-type text from a metrics row metadata object.
 *
 * Expected metadata format:
 * - `behavior_type`: string (preferred), e.g. "Style", "Negative (critical)"
 * - `group`: string, either:
 *   - plain behavior type (legacy): "Style"
 *   - combined role + behavior type: "assistant_Style", "user_Negative (critical)"
 *
 * Returns:
 * - behavior-type label string when available
 * - null when no behavior-type-like value can be derived
 */
function getBehaviorTypeFromMetadata(
  metadata: ModelClusterRow['metadata'] | undefined,
): string | null {
  if (!metadata) return null;

  const rawBehaviorType =
    metadata.behavior_type != null ? String(metadata.behavior_type).trim() : '';
  if (rawBehaviorType) {
    return rawBehaviorType;
  }

  const rawGroup = metadata.group != null ? String(metadata.group).trim() : '';
  if (!rawGroup) {
    return null;
  }

  // Support combined role_behavior_type values by taking suffix after first underscore.
  if (rawGroup.includes('_')) {
    const suffix = rawGroup.split('_').slice(1).join('_').trim();
    return suffix || null;
  }

  return rawGroup;
}

// Normalize group values to standard categories
function normalizeGroup(group: string | undefined): string | null {
  if (!group) return null;
  const v = group.toLowerCase().trim().replace(/[_\s]+/g, '_');

  if (v === 'negative_(critical)' || v === 'negative_critical' || v === 'negative(critical)') return 'negative_critical';
  if (v === 'negative_(non-critical)' || v === 'negative_non-critical' || v === 'negative_non_critical' || v === 'negative(non-critical)') return 'negative_non_critical';
  if (v === 'positive') return 'positive';
  if (v === 'style' || v === 'stylistic') return 'style';
  if (v === 'phrasing') return 'phrasing';
  if (v === 'domain' || v === 'problem_domain') return 'problem_domain';
  if (v === 'skills_required' || v === 'skillsrequired') return 'skills_required';

  return null;
}

function getGroupColor(group: string): string {
  switch (group) {
    case 'positive': return retroColors.green;
    case 'negative_critical': return retroColors.red;
    case 'negative_non_critical': return retroColors.orange;
    case 'style': return '#8B5CF6';
    case 'phrasing': return '#0EA5E9';
    case 'problem_domain': return '#06B6D4';
    case 'skills_required': return '#14B8A6';
    default: return '#6B7280'; // gray
  }
}

function getGroupLabel(group: string): string {
  switch (group) {
    case 'positive': return 'Positive';
    case 'negative_critical': return 'Negative (critical)';
    case 'negative_non_critical': return 'Negative (non-critical)';
    case 'style': return 'Stylistic';
    case 'phrasing': return 'Phrasing';
    case 'problem_domain': return 'Problem Domain';
    case 'skills_required': return 'Skills Required';
    default: return group;
  }
}

export function MetricsOverviewBanner({ data, qualityMetrics, onNavigateToMisalignedSection }: MetricsOverviewBannerProps) {
  const stats = useMemo(() => {
    // Count unique clusters (total and by group)
    const allClusters = new Set<string>();
    const clustersByGroup = new Map<string, Set<string>>();

    // Track which metrics are misaligned (across all behaviors)
    const misalignedMetrics = new Set<string>();

    data.forEach(row => {
      // Count total unique clusters
      allClusters.add(row.cluster);

      const behaviorType = getBehaviorTypeFromMetadata(row.metadata);
      const group = normalizeGroup(behaviorType ?? undefined);

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

    // Convert group counts to sorted array (including positive)
    const groupCounts = Array.from(clustersByGroup.entries())
      .map(([group, clusters]) => ({
        group,
        count: clusters.size,
        color: getGroupColor(group),
        label: getGroupLabel(group)
      }))
      .sort((a, b) => {
        // Sort order: positive, negative_critical, negative_non_critical, style
        const order = ['positive', 'negative_critical', 'negative_non_critical', 'style'];
        return order.indexOf(a.group) - order.indexOf(b.group);
      });

    return {
      totalClusters: allClusters.size,
      groupCounts,
      misalignedMetrics: misalignedMetrics.size
    };
  }, [data, qualityMetrics]);

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        mt: 0,
        p: 2.5,
        mb: 1.5,
        bgcolor: '#ffffff',
        borderRadius: 2,
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(white, white), linear-gradient(90deg, #2563eb, #10b981)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'flex-start',
        justifyContent: 'space-between'
      }}
    >
      {/* Total clusters and clusters by type */}
      <Box>
        <Typography variant="caption" sx={{ mb: 1, display: 'block', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
          Clusters overview
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {/* Total clusters */}
          <Chip
            label={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}>
                  {stats.totalClusters}
                </Typography>
                <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb' }}>
                  Total
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#2563eb15',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': {
                px: 0
              }
            }}
          />
          {/* Clusters by behavior type */}
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
