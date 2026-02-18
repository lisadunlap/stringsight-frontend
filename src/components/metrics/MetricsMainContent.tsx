/**
 * MetricsMainContent - Main content area displaying metrics visualizations.
 * 
 * This component renders the main metrics content in three sections:
 * 1. Benchmark Section - Per-model performance bar chart
 * 2. Cluster Plots - Four chart types (frequency, frequency_delta, quality, quality_delta)
 * 3. Model Cards - Two-column grid with top clusters per model
 * 
 * The layout follows the specifications in METRICS_README.md.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Divider,
  Alert
} from '@mui/material';
import { BenchmarkSection } from './BenchmarkSection';
import { ClusterPlotsSection } from './ClusterPlotsSection';
import { TopClustersSummary } from './TopClustersSummary';
import { MetricsInsightsOverview } from './MetricsInsightsOverview';
import type {
  MetricsFilters,
  ModelClusterPayload,
  ModelBenchmarkPayload,
  MetricsSummary,
  ModelClusterRow,
  ClusterScoresPayload,
} from '../../types/metrics';

interface MetricsMainContentProps {
  filters: MetricsFilters;
  modelClusterData: ModelClusterPayload;
  benchmarkData?: ModelBenchmarkPayload;
  /** Cluster-level aggregate scores across all models */
  clusterScores?: ClusterScoresPayload | null;
  qualityMetrics: string[];
  summary?: MetricsSummary;
  /** Controls visibility of sections; default true for all when omitted */
  showBenchmark?: boolean;
  showClusterPlots?: boolean;
  showModelCards?: boolean;
  onNavigateToCluster?: (clusterName: string) => void;
  onViewExample?: (cluster: ModelClusterRow) => void;
  /** Data method - single_model or side_by_side */
  method?: 'single_model' | 'side_by_side' | 'unknown';
  /** Ref to the misaligned patterns section for scrolling */
  misalignedSectionRef?: React.RefObject<HTMLDivElement>;
  /** Handler for navigating to a specific metric */
  onNavigateToMetric?: (metricName: string) => void;
  /** Optional filter change handler for inline filter dropdown */
  onFiltersChange?: (filters: MetricsFilters) => void;
  /** Available behavior types (normalized) for behavior-type filter */
  availableBehaviorTypes?: string[];
  /** Whether confidence intervals are present in the data */
  hasConfidenceIntervals?: boolean;
  /**
   * Global per-metric absolute score ranges used for normalizing quality deltas.
   * Keys are base metric names (e.g., "win_rate") as exposed in `qualityMetrics`.
   */
  scoreRanges?: Record<string, { min: number; max: number }>;
}

export function MetricsMainContent({
  filters,
  modelClusterData,
  benchmarkData,
  clusterScores,
  qualityMetrics,
  summary,
  showBenchmark = true,
  showClusterPlots = false,
  showModelCards = false,
  onNavigateToCluster,
  onViewExample,
  method = 'unknown',
  misalignedSectionRef,
  onNavigateToMetric,
  onFiltersChange,
  availableBehaviorTypes,
  hasConfidenceIntervals,
  scoreRanges,
}: MetricsMainContentProps) {

  // Normalize group names to standard categories (same as in MetricsTab)
  const normalizeGroup = (value: unknown): string => {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'negative (critical)' || v === 'negative critical') return 'negative_critical';
    if (v === 'negative (non-critical)' || v === 'negative non-critical' || v === 'negative (non critical)') return 'negative_non_critical';
    if (v === 'positive') return 'positive';
    if (v === 'style') return 'style';
    return v;
  };

  // Apply filters to the data
  const { filteredData, topClusters, baseFilteredData } = useMemo(() => {
    let filtered = [...modelClusterData.data];

    const hasRoleMetadata = filtered.some((row: any) => {
      const meta = row.metadata || {};
      return (
        (meta.role != null && String(meta.role).trim() !== '') ||
        (meta.group != null && String(meta.group).trim() !== '')
      );
    });
    const isUserRow = (row: any): boolean => {
      const meta = row.metadata || {};
      const role = meta.role != null ? String(meta.role).toLowerCase() : '';
      if (role === 'user') return true;
      const group = meta.group != null ? String(meta.group).toLowerCase() : '';
      return group === 'user' || group.startsWith('user_');
    };
    // Filter by selected models
    if (filters.selectedModels.length > 0) {
      filtered = filtered.filter(row =>
        filters.selectedModels.includes(row.model)
      );
    }

    // Filter by selected groups (raw metadata.group values)
    if (filters.selectedGroups.length > 0) {
      filtered = filtered.filter(row => {
        const group = row.metadata?.group;
        return group && filters.selectedGroups.includes(group);
      });
    }

    // Filter by selected behavior types (normalized)
    if (filters.selectedBehaviorTypes && filters.selectedBehaviorTypes.length > 0) {
      filtered = filtered.filter(row => {
        const group = row.metadata?.group;
        const normalized = normalizeGroup(group);
        return normalized && filters.selectedBehaviorTypes.includes(normalized);
      });
    }

    // Filter by significance (if enabled)
    if (filters.significanceOnly) {
      filtered = filtered.filter(row => {
        // Check proportion significance
        if (row.proportion_delta_significant) return true;

        // Check quality significance for current metric
        const qualitySigKey = `quality_delta_${filters.qualityMetric}_significant`;
        if (row[qualitySigKey as keyof typeof row]) return true;

        return false;
      });
    }

    // baseFiltered: full data for MetricsInsightsOverview (Skills tab needs user clusters)
    const baseFiltered = filtered;

    // For Model Behaviors, TopClustersSummary: assistant-only when role metadata exists
    const modelBehaviorsFiltered = hasRoleMetadata ? filtered.filter((r: any) => !isUserRow(r)) : filtered;
    const allClusterNames = [...new Set(modelBehaviorsFiltered.map((row: any) => row.cluster))];
    
    // Sort model-behaviors rows for TopClustersSummary
    modelBehaviorsFiltered.sort((a, b) => {
      const getSortValue = (row: typeof a, sortBy: string): number => {
        switch (sortBy) {
          case 'proportion_desc':
          case 'proportion_asc':
            return row.proportion || 0;
          case 'proportion_delta_desc':
          case 'proportion_delta_asc':
            return row.proportion_delta || 0;
          case 'quality_desc':
          case 'quality_asc':
            const qualityKey = `quality_${filters.qualityMetric}`;
            return (row[qualityKey as keyof typeof row] as number) || 0;
          case 'quality_delta_desc':
          case 'quality_delta_asc':
            const qualityDeltaKey = `quality_delta_${filters.qualityMetric}`;
            return (row[qualityDeltaKey as keyof typeof row] as number) || 0;
          case 'size_desc':
          case 'size_asc':
            return row.size || 0;
          default:
            return 0;
        }
      };
      
      const aVal = getSortValue(a, filters.sortBy);
      const bVal = getSortValue(b, filters.sortBy);
      
      const ascending = filters.sortBy.includes('_asc');
      return ascending ? aVal - bVal : bVal - aVal;
    });
    
    return {
      filteredData: modelBehaviorsFiltered,
      topClusters: allClusterNames,
      baseFilteredData: baseFiltered
    };
  }, [modelClusterData.data, filters]);


  return (
    <Box sx={{
      height: '100%',
      width: '100%',
      '& > *': { mb: 4 }
    }}>
      {/* Insights Overview - Always render so filters are always visible */}
      <MetricsInsightsOverview
        data={baseFilteredData}
        filters={filters}
        qualityMetrics={qualityMetrics}
        onNavigateToCluster={onNavigateToCluster}
        method={method}
        topClusters={topClusters}
        summary={summary || undefined}
        showCI={filters.showCI && (summary?.has_confidence_intervals || false)}
        // Header-level filter dropdown configuration
        onFiltersChange={onFiltersChange}
        availableModels={modelClusterData.models}
        availableQualityMetrics={qualityMetrics}
        availableBehaviorTypes={availableBehaviorTypes}
        hasConfidenceIntervals={hasConfidenceIntervals}
        scoreRanges={scoreRanges}
      />
      <Divider />

      {/* No data message - show below filters if no data matches */}
      {filteredData.length === 0 && (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <strong>No data matches the current filters</strong>
            <br />
            Try adjusting your filter settings to see results.
          </Alert>
        </Box>
      )}

      {/* Model Cards Section */}
      {showModelCards && (
        <>
          <TopClustersSummary
            data={filteredData}
            filters={filters}
            onNavigateToCluster={onNavigateToCluster}
          />
          <Divider />
        </>
      )}

      {/* Benchmark Section - Temporarily disabled */}
      {/* {showBenchmark && benchmarkData && benchmarkData.data.length > 0 && (
        <>
          <BenchmarkSection
            data={benchmarkData}
            qualityMetrics={qualityMetrics}
          />
          <Divider />
        </>
      )} */}

      {/* Cluster Plots Section */}
      {showClusterPlots && (
        <ClusterPlotsSection
          data={filteredData}
          filters={filters}
          qualityMetrics={qualityMetrics}
          showCI={filters.showCI && (summary?.has_confidence_intervals || false)}
          topClusters={topClusters}
          onNavigateToCluster={onNavigateToCluster}
        />
      )}
    </Box>
  );
}

export default MetricsMainContent;