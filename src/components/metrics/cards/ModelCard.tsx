/**
 * ModelCard - Individual model performance card.
 * 
 * Displays top clusters for a single model with:
 * - Color-coded left border (green/red for positive/negative delta)
 * - Significance badges (F for frequency, Q for quality)
 * - Cluster metadata tags as chips
 * - Quality metrics with delta indicators
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Stack,
  useTheme
} from '@mui/material';
import { ClusterItem } from './ClusterItem';
import type { ModelClusterRow, MetricsFilters, ModelCardData } from '../../../types/metrics';


interface ModelCardProps {
  card: ModelCardData;
  filters: MetricsFilters;
  qualityMetrics: string[];
  onNavigateToCluster?: (clusterName: string) => void;
}

export function ModelCard({
  card,
  filters,
  qualityMetrics,
  onNavigateToCluster
}: ModelCardProps) {
  const theme = useTheme();

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        height: 500, 
        display: 'flex', 
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Stack spacing={2} sx={{ height: '100%' }}>
        {/* Model Header */}
        <Box>
          <Typography variant="h6" noWrap title={card.model}>
            {card.model.split('/').pop() || card.model}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Top clusters by relative frequency
          </Typography>
        </Box>

        {/* Cluster Items */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Stack spacing={1.5}>
            {card.topClusters.map((cluster, index) => (
              <ClusterItem
                key={`${cluster.model}-${cluster.cluster}`}
                cluster={cluster}
                rank={index + 1}
                qualityMetric={filters.qualityMetric}
                onNavigateToCluster={onNavigateToCluster}
              />
            ))}
            
            {card.topClusters.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No clusters match current filters
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

export default ModelCard;
