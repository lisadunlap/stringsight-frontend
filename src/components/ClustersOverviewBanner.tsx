import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

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

      clusters.forEach((cluster) => {
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
          <Chip
            label={
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}
                >
                  {counts.positive}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#10B981' }}
                >
                  Positive
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#10B98115',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': { px: 0 },
            }}
          />

          <Chip
            label={
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#EF4444' }}
                >
                  {counts.negativeCritical}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#EF4444' }}
                >
                  Negative (Critical)
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#EF444415',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': { px: 0 },
            }}
          />

          <Chip
            label={
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#F97316' }}
                >
                  {counts.negativeNonCritical}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#F97316' }}
                >
                  Negative (Non-Critical)
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#F9731615',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': { px: 0 },
            }}
          />

          <Chip
            label={
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#8B5CF6' }}
                >
                  {counts.style}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#8B5CF6' }}
                >
                  Style
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#8B5CF615',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': { px: 0 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

