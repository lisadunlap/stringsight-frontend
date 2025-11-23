import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { retroColors } from '../theme';

interface PropertiesOverviewBannerProps {
  /**
   * Array of property rows returned from extraction.
   * Expected keys (if present) that affect counts:
   * - `behavior_type`: string label such as "positive", "negative (critical)", "negative (non-critical)", "style".
   */
  properties: any[];
}

/**
 * Overview banner for extracted properties, showing counts of
 * positive / negative (critical) / negative (non-critical) / style properties.
 *
 * Used in the Extraction step so that, even before any extraction,
 * users see "0" counts that update as properties are added.
 */
export default function PropertiesOverviewBanner({
  properties,
}: PropertiesOverviewBannerProps) {
  const counts = React.useMemo(
    () => {
      const result = {
        positive: 0,
        negativeCritical: 0,
        negativeNonCritical: 0,
        style: 0,
      };

      properties.forEach((row) => {
        const rawType =
          (row && (row.behavior_type ?? row.category)) != null
            ? String(row.behavior_type ?? row.category)
            : '';
        const type = rawType.toLowerCase().trim();

        if (type === 'positive') {
          result.positive += 1;
        } else if (type === 'negative (critical)' || type === 'negative(critical)') {
          result.negativeCritical += 1;
        } else if (
          type === 'negative (non-critical)' ||
          type === 'negative(non-critical)'
        ) {
          result.negativeNonCritical += 1;
        } else if (type === 'style') {
          result.style += 1;
        }
      });

      return result;
    },
    [properties],
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
          Properties overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip
            title="Total number of properties"
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
                    {properties.length}
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
                cursor: 'help',
              }}
            />
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}



