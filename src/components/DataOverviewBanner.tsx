import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';

/**
 * Shape of the data overview summary shown in the Data tab banner.
 *
 * - `rowCount`: formatted total number of rows (e.g., "1,234").
 * - `uniquePrompts`: formatted count of unique prompts.
 * - `uniqueModels`: formatted count of unique models across the dataset.
 */
export interface DataOverviewSummary {
  rowCount: string;
  uniquePrompts: string;
  uniqueModels: string;
}

export type DataMethod = 'single_model' | 'side_by_side' | 'unknown';

interface DataOverviewBannerProps {
  /**
   * Aggregated dataset summary used for the overview banner.
   */
  dataOverview: DataOverviewSummary;
  /**
   * Detected data layout:
   * - `single_model`: one model response column per row.
   * - `side_by_side`: paired model responses per row.
   * - `unknown`: format not yet inferred.
   */
  method: DataMethod;
}

/**
 * Top-of-page banner for the Data tab, matching the visual style of the
 * overview banners used in the Properties and Clusters views.
 *
 * Displays a compact summary of dataset size and structure so users can
 * quickly understand how many rows, prompts, and models are present.
 */
export function DataOverviewBanner({
  dataOverview,
  method,
}: DataOverviewBannerProps) {
  const methodLabel =
    method === 'single_model'
      ? 'Single model dataset'
      : method === 'side_by_side'
      ? 'Side-by-side comparison'
      : 'Format not detected yet';

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
          Dataset overview
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Chip
            label={
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#111827',
                  }}
                >
                  {dataOverview.rowCount}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#4b5563',
                  }}
                >
                  rows
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#eff6ff',
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
                  sx={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#2563eb',
                  }}
                >
                  {dataOverview.uniquePrompts}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#2563eb',
                  }}
                >
                  unique prompts
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#dbeafe',
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
                  sx={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#10b981',
                  }}
                >
                  {dataOverview.uniqueModels}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#10b981',
                  }}
                >
                  unique models
                </Typography>
              </Box>
            }
            size="medium"
            sx={{
              bgcolor: '#dcfce7',
              height: 'auto',
              py: 0.75,
              px: 1.25,
              border: 'none',
              '& .MuiChip-label': { px: 0 },
            }}
          />
        </Stack>
      </Box>

      <Box sx={{ minWidth: 200 }}>
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
          Data format
        </Typography>
        <Chip
          label={methodLabel}
          size="small"
          sx={{
            bgcolor: '#f9fafb',
            borderColor: '#e5e7eb',
            color: '#374151',
            fontWeight: 500,
          }}
          variant="outlined"
        />
      </Box>
    </Box>
  );
}

export default DataOverviewBanner;




