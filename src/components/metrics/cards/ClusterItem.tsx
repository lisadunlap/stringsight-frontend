/**
 * ClusterItem - Rich cluster display within model cards.
 * 
 * Features:
 * - Color-coded left border based on proportion delta
 * - Full cluster label with hover truncation
 * - Frequency stats (percentage, delta, count)
 * - Significance badges (F/Q)
 * - Quality metrics with delta indicators
 * - Metadata tags as chips
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Stack,
  useTheme,
  Button
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { TagChips } from './TagChips';
import type { ModelClusterRow } from '../../../types/metrics';

interface ClusterItemProps {
  cluster: ModelClusterRow;
  rank: number;
  qualityMetric: string;
  onNavigateToCluster?: (clusterName: string) => void;
}

export function ClusterItem({
  cluster,
  rank,
  qualityMetric,
  onNavigateToCluster
}: ClusterItemProps) {
  const theme = useTheme();

  // Color coding based on metadata group field
  const getColorFromMetadata = () => {
    if (!cluster.metadata) return theme.palette.grey[300];

    const group = cluster.metadata.group || '';
    const groupLower = String(group).trim().toLowerCase();
    
    if (groupLower === 'negative (critical)' || groupLower === 'negative critical') {
      return '#DC2626'; // Red
    }
    if (groupLower === 'negative (non-critical)' || groupLower === 'negative non-critical' || groupLower === 'negative (non critical)') {
      return '#CA8A04'; // Yellow
    }
    if (groupLower === 'positive') {
      return '#16A34A'; // Green
    }
    if (groupLower === 'style') {
      return '#9C27B0'; // Purple
    }
    // Default grey for any other groups
    return theme.palette.grey[300];
  };

  const borderColor = getColorFromMetadata();

  return (
    <Box
      sx={{
        borderLeft: 4,
        borderLeftColor: borderColor,
        pl: 2,
        py: 1.5,
        backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
        borderRadius: 1,
        '&:hover': {
          backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100'
        }
      }}
    >
      <Stack spacing={1.5}>
        {/* Cluster Label */}
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 500,
            lineHeight: 1.4
          }}
        >
          {cluster.cluster}
        </Typography>
        
        {/* Metadata Tags */}
        {cluster.metadata && (
          <TagChips metadata={cluster.metadata} />
        )}
        
        {/* Navigate Button */}
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={() => onNavigateToCluster?.(cluster.cluster)}
          sx={{
            alignSelf: 'flex-start',
            textTransform: 'none',
            fontSize: '0.75rem'
          }}
        >
          View in Clusters
        </Button>
      </Stack>
    </Box>
  );
}

export default ClusterItem;
