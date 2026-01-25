import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { retroColors } from '../theme';

interface ClustersOverviewBannerProps {
  /**
   * Array of cluster objects.
   * Expected structure: clusters with `meta.group` property indicating behavior type:
   * - "positive"
   * - "negative (critical)" or "negative(critical)"
   * - "negative (non-critical)" or "negative(non-critical)"
   * - "style"
   */
  clusters: any[];
}

/**
 * Overview banner for clusters, showing counts of
 * positive / negative (critical) / negative (non-critical) / style clusters.
 *
 * Matches the visual style of PropertiesOverviewBanner and DataOverviewBanner.
 */
export default function ClustersOverviewBanner({
  clusters,
}: ClustersOverviewBannerProps) {
  const counts = React.useMemo(
    () => {
      const result = {
        positive: 0,
        negativeCritical: 0,
        negativeNonCritical: 0,
        style: 0,
      };

      // Filter out outlier clusters
      const nonOutlierClusters = clusters.filter((cluster) => {
        const label = String(cluster.label || '');
        const isOutlier = label.toLowerCase().includes('outlier') ||
                          (typeof cluster.id === 'string' && cluster.id.startsWith('-')) ||
                          (typeof cluster.id === 'number' && cluster.id < 0);
        return !isOutlier;
      });

      nonOutlierClusters.forEach((cluster) => {
        const rawType =
          (cluster && cluster.meta && cluster.meta.group) != null
            ? String(cluster.meta.group)
            : '';
        const type = rawType.toLowerCase().trim().replace(/[_\s]+/g, '_');

        if (type === 'positive') {
          result.positive += 1;
        } else if (
          type === 'negative_(critical)' ||
          type === 'negative_critical' ||
          type === 'negative(critical)'
        ) {
          result.negativeCritical += 1;
        } else if (
          type === 'negative_(non-critical)' ||
          type === 'negative_(non_critical)' ||
          type === 'negative_non-critical' ||
          type === 'negative_non_critical' ||
          type === 'negative(non-critical)'
        ) {
          result.negativeNonCritical += 1;
        } else if (type === 'style' || type === 'stylistic') {
          result.style += 1;
        }
      });

      return result;
    },
    [clusters],
  );

  return (
    <Box
      sx={{
        mb: 1.5,
        mt: 0,
        p: 2.5,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        border: '2px solid transparent',
        backgroundImage:
          'linear-gradient(white, white), linear-gradient(90deg, #2563eb, #10b981)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow:
          '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <Box>
        <Typography
          variant="caption"
          sx={{
            mb: 1,
            display: 'block',
            color: '#6b7280',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          Clusters overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip
            title="Total number of clusters"
            arrow
            placement="top"
          >
            <Chip
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}
                  >
                    {clusters.filter((c) => {
                      const label = String(c.label || '');
                      const isOutlier = label.toLowerCase().includes('outlier') ||
                                        (typeof c.id === 'string' && c.id.startsWith('-')) ||
                                        (typeof c.id === 'number' && c.id < 0);
                      return !isOutlier;
                    }).length}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb' }}
                  >
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
                '& .MuiChip-label': { px: 0 },
                cursor: 'help',
              }}
            />
          </Tooltip>

          <Tooltip
            title="Key insight about the task, failure recovery, defending against jailbreak attempts, etc."
            arrow
            placement="top"
          >
            <Chip
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.1rem', fontWeight: 700, color: retroColors.green }}
                  >
                    {counts.positive}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.85rem', fontWeight: 600, color: retroColors.green }}
                  >
                    Positive
                  </Typography>
                </Box>
              }
              size="medium"
              sx={{
                bgcolor: `${retroColors.green}15`,
                height: 'auto',
                py: 0.75,
                px: 1.25,
                border: 'none',
                '& .MuiChip-label': { px: 0 },
                cursor: 'help',
              }}
            />
          </Tooltip>

          <Tooltip
            title="Direct cause of task failure or serious policy violation (e.g. being jailbroken, gibberish)"
            arrow
            placement="top"
          >
            <Chip
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.1rem', fontWeight: 700, color: retroColors.red }}
                  >
                    {counts.negativeCritical}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.85rem', fontWeight: 600, color: retroColors.red }}
                  >
                    Negative (Critical)
                  </Typography>
                </Box>
              }
              size="medium"
              sx={{
                bgcolor: `${retroColors.red}15`,
                height: 'auto',
                py: 0.75,
                px: 1.25,
                border: 'none',
                '& .MuiChip-label': { px: 0 },
                cursor: 'help',
              }}
            />
          </Tooltip>

          <Tooltip
            title="A behavior which is not desirable but not the direct cause of failure (e.g. a miscalculation that was later corrected)"
            arrow
            placement="top"
          >
            <Chip
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.1rem', fontWeight: 700, color: retroColors.orange }}
                  >
                    {counts.negativeNonCritical}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.85rem', fontWeight: 600, color: retroColors.orange }}
                  >
                    Negative (Non-Critical)
                  </Typography>
                </Box>
              }
              size="medium"
              sx={{
                bgcolor: `${retroColors.orange}15`,
                height: 'auto',
                py: 0.75,
                px: 1.25,
                border: 'none',
                '& .MuiChip-label': { px: 0 },
                cursor: 'help',
              }}
            />
          </Tooltip>

          <Tooltip
            title="Purely stylistic with no impact on correctness or safety (e.g. tone, formatting)"
            arrow
            placement="top"
          >
            <Chip
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.1rem', fontWeight: 700, color: retroColors.purple }}
                  >
                    {counts.style}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.85rem', fontWeight: 600, color: retroColors.purple }}
                  >
                    Style
                  </Typography>
                </Box>
              }
              size="medium"
              sx={{
                bgcolor: `${retroColors.purple}15`,
                height: 'auto',
                py: 0.75,
                px: 1.25,
                border: 'none',
                '& .MuiChip-label': { px: 0 },
                cursor: 'help',
              }}
            />
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

