/**
 * MetricsTab - Main container for the metrics visualization interface.
 * 
 * This component displays model performance metrics with filtering controlled
 * by the sidebar. It provides a comprehensive view of benchmarks, cluster plots,
 * and model cards based on the filters passed from the parent component.
 * 
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Main Content Area (Full Width)                          │
 * │ - Benchmark Section                                      │
 * │ - Cluster Plots (2 types)                               │
 * │ - Model Cards (2-column)                                │
 * └─────────────────────────────────────────────────────────┘
 * 
 * Filter controls are in the sidebar (MetricsPanel component).
 */

import { useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Alert, 
  CircularProgress, 
  Fade 
} from '@mui/material';
import { MetricsMainContent } from './MetricsMainContent';
import { MetricsOverviewBanner } from './MetricsOverviewBanner';
import { MetricsFilterBar } from './MetricsFilterBar';
import type { MetricsFilters, MetricsSummary, ModelClusterPayload, ModelBenchmarkPayload, ModelClusterRow } from '../../types/metrics';

interface MetricsTabProps {
  /** Pre-loaded results data */
  resultsData: {
    model_cluster_scores?: any;
    cluster_scores?: any;
    model_scores?: any;
  };

  /** Filters controlled by the sidebar */
  filters: MetricsFilters;

  /** Callback to update filters */
  onFiltersChange?: (filters: MetricsFilters) => void;

  /** Callback to update available data for sidebar */
  onDataProcessed?: (data: {
    availableModels: string[];
    availableGroups: string[];
    availableBehaviorTypes?: string[];
    availableQualityMetrics: string[];
    summary: MetricsSummary | null;
  }) => void;

  /** Whether to show debug information */
  debug?: boolean;

  /** Section visibility controls (default: all true) */
  showBenchmark?: boolean;
  showClusterPlots?: boolean;
  showModelCards?: boolean;

  /** Callback to navigate to a cluster in the Clusters tab */
  onNavigateToCluster?: (clusterName: string) => void;

  /** Callback to view a random example from a cluster */
  onViewExample?: (cluster: ModelClusterRow) => void;

  /** Total unique conversations (from backend clustering response) */
  totalUniqueConversations?: number | null;

  /** Data method - single_model or side_by_side */
  method?: 'single_model' | 'side_by_side' | 'unknown';
}

export function MetricsTab({
  resultsData,
  filters,
  onFiltersChange,
  onDataProcessed,
  debug = false,
  showBenchmark = true,
  showClusterPlots = false,
  showModelCards = false,
  onNavigateToCluster,
  onViewExample,
  totalUniqueConversations,
  method = 'unknown'
}: MetricsTabProps) {

  // Process the existing resultsData instead of fetching from API
  const processedData = useMemo(() => {
    console.log('[MetricsTab] Processing data with method:', method);
    console.log('[MetricsTab] Results data:', resultsData);
    
    if (!resultsData?.model_cluster_scores) {
      console.log('[MetricsTab] No model cluster scores data available');
      return {
        summary: null as MetricsSummary | null,
        modelClusterData: null as ModelClusterPayload | null,
        benchmarkData: null as ModelBenchmarkPayload | null,
        qualityMetrics: [] as string[],
        availableGroups: [] as string[],
        isLoading: false,
        error: new Error("No model cluster scores data available"),
        refetch: () => Promise.resolve()
      };
    }

    // Server now always returns JSONL format (array of objects)
    const allModelClusterScores = resultsData.model_cluster_scores || [];
    
    // Filter out outlier clusters (case-insensitive check for cluster names starting with "outliers")
    const modelClusterScores = allModelClusterScores.filter((row: any) => {
      const clusterName = row.cluster ? String(row.cluster).toLowerCase() : '';
      return !clusterName.startsWith('outliers');
    });
    
    // Extract models, clusters, and groups
    const models = [...new Set(modelClusterScores.map((row: any) => row.model))].sort();
    const clusters = [...new Set(modelClusterScores.map((row: any) => row.cluster))];
    
    console.log('[MetricsTab] Extracted models:', models);
    console.log('[MetricsTab] Extracted clusters:', clusters.length);
    
    // Extract groups from metadata and normalize behavior types
    const groups = new Set<string>();
    const behaviorTypes = new Set<string>();
    
    // Normalize group names to standard categories
    const normalizeGroup = (value: unknown): string => {
      const v = String(value || '').trim().toLowerCase();
      if (!v) return '';
      if (v === 'negative (critical)' || v === 'negative critical') return 'negative_critical';
      if (v === 'negative (non-critical)' || v === 'negative non-critical' || v === 'negative (non critical)') return 'negative_non_critical';
      if (v === 'positive') return 'positive';
      if (v === 'style') return 'style';
      return v;
    };
    
    modelClusterScores.forEach((row: any) => {
      if (row.metadata && typeof row.metadata === 'object' && row.metadata.group) {
        const rawGroup = row.metadata.group;
        groups.add(rawGroup);
        // Also add normalized behavior type
        const normalized = normalizeGroup(rawGroup);
        if (normalized) {
          behaviorTypes.add(normalized);
        }
      }
    });
    
    // Debug: Log ALL keys from first row to see what we're working with
    if (modelClusterScores[0]) {
      console.log('[MetricsTab] ALL keys in first row:', Object.keys(modelClusterScores[0]));
      console.log('[MetricsTab] Sample row:', modelClusterScores[0]);
    }

    // Extract base quality metrics from JSONL format (exclude delta/significance/CI)
    const qualityMetrics = new Set<string>();
    modelClusterScores.forEach((row: any) => {
      Object.keys(row).forEach(key => {
        if (
          key.startsWith('quality_') &&
          !key.startsWith('quality_delta_') &&
          !key.endsWith('_significant') &&
          !key.includes('_ci_')
        ) {
          const metric = key.replace('quality_', '');
          qualityMetrics.add(metric);
        }
      });
    });

    console.log('[MetricsTab] Extracted quality metrics:', Array.from(qualityMetrics));

    // Detect confidence intervals from data
    const hasConfidenceIntervals = modelClusterScores.some((row: any) => {
      return row.proportion_ci_lower !== undefined ||
             row.proportion_ci_upper !== undefined ||
             Object.keys(row).some(key => key.includes('_ci_lower') || key.includes('_ci_upper'));
    });

    // Debug logging for metric extraction
    if (import.meta.env.DEV) {
      console.log('MetricsTab Debug - Extracted quality metrics:', Array.from(qualityMetrics));
      console.log('MetricsTab Debug - Extracted groups:', Array.from(groups));
      console.log('MetricsTab Debug - Has confidence intervals:', hasConfidenceIntervals);
      console.log('MetricsTab Debug - Sample row keys:', modelClusterScores[0] ? Object.keys(modelClusterScores[0]).filter(k => k.startsWith('quality_')) : []);
      console.log('MetricsTab Debug - CI keys:', modelClusterScores[0] ? Object.keys(modelClusterScores[0]).filter(k => k.includes('_ci_')) : []);
      console.log('MetricsTab Debug - Full sample row:', modelClusterScores[0]);
      console.log('MetricsTab Debug - Sample row.quality:', modelClusterScores[0]?.quality);
    }

    // Create summary
    const summary: MetricsSummary = {
      source: 'json' as const,
      models: models.length,
      clusters: clusters.length,
      total_battles: totalUniqueConversations || 0, // Use value from parent (backend clustering response)
      quality_metrics: qualityMetrics.size,
      quality_metric_names: Array.from(qualityMetrics),
      has_confidence_intervals: hasConfidenceIntervals,
      significant_differences: 0 // TODO: compute from data
    };

    // Transform model cluster data for frontend
    const modelClusterData: ModelClusterPayload = {
      source: 'json' as const,
      models: models as string[],
      clusters: clusters as string[],
      quality_metrics: Array.from(qualityMetrics),
      total_battles: modelClusterScores.length,
      data: modelClusterScores
    };

    // Process benchmark data if available
    const benchmarkData: ModelBenchmarkPayload | undefined = resultsData.model_scores ? {
      source: 'json' as const,
      models: models as string[],
      quality_metrics: Array.from(qualityMetrics),
      data: Array.isArray(resultsData.model_scores) ? resultsData.model_scores : []
    } : undefined;

    return {
      summary,
      modelClusterData,
      benchmarkData,
      qualityMetrics: Array.from(qualityMetrics),
      availableGroups: Array.from(groups),
      availableBehaviorTypes: Array.from(behaviorTypes).sort(),
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve()
    };
  }, [resultsData, totalUniqueConversations]);

  const {
    summary,
    modelClusterData, 
    benchmarkData,
    qualityMetrics,
    availableGroups,
    availableBehaviorTypes,
    isLoading,
    error,
    refetch
  } = processedData;

  // Notify parent when data is processed (for sidebar to update available options)
  useEffect(() => {
    if (onDataProcessed && modelClusterData) {
      onDataProcessed({
        availableModels: modelClusterData.models,
        availableGroups: availableGroups,
        availableBehaviorTypes: availableBehaviorTypes || [],
        availableQualityMetrics: qualityMetrics,
        summary: summary
      });
    }
  }, [onDataProcessed, modelClusterData, availableGroups, availableBehaviorTypes, qualityMetrics, summary]);

  // Loading state
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '60vh',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading metrics data...
        </Typography>
        {debug && (
          <Typography variant="caption" color="text.disabled">
            Data source: {summary?.source || 'loaded_results'}
          </Typography>
        )}
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <button onClick={() => refetch()}>
              Retry
            </button>
          }
        >
          <strong>Failed to load metrics data</strong>
          <br />
          {error.message}
          {debug && (
            <>
              <br />
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                Data source: {(summary as any)?.source || 'unavailable'}
              </Typography>
            </>
          )}
        </Alert>
      </Box>
    );
  }

  // No data state
  if (!modelClusterData || modelClusterData.data.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <strong>No metrics data available</strong>
          <br />
          No model-cluster metrics found in the specified results directory. 
          Make sure the metrics have been computed and saved.
          {debug && (
            <>
              <br />
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                Data source: {(summary as any)?.source || 'unavailable'}
              </Typography>
            </>
          )}
        </Alert>
      </Box>
    );
  }

  

  // Ref for scrolling to misaligned patterns section
  const misalignedSectionRef = useRef<HTMLDivElement>(null);

  // Handler to scroll to misaligned patterns section
  const handleNavigateToMisalignedSection = () => {
    if (misalignedSectionRef.current) {
      misalignedSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Handler for navigating to a specific metric
  // For now, just scroll to the misaligned section
  // Could be extended to filter or highlight the metric
  const handleNavigateToMetric = (metricName: string) => {
    handleNavigateToMisalignedSection();
    // TODO: Could add filtering or highlighting logic here
  };

  return (
    <Fade in={true} timeout={300}>
      <Box sx={{ height: 'calc(100vh - 120px)', overflow: 'auto', pt: 0, px: 3, pb: 3 }}>
        {/* Overview Banner */}
        <MetricsOverviewBanner
          data={modelClusterData.data}
          qualityMetrics={qualityMetrics || []}
          onNavigateToMisalignedSection={handleNavigateToMisalignedSection}
        />

        {/* Main Content Area - Full Width */}
        <MetricsMainContent
          filters={filters}
          modelClusterData={modelClusterData}
          benchmarkData={benchmarkData}
          qualityMetrics={qualityMetrics || []}
          summary={summary}
          showBenchmark={showBenchmark}
          showClusterPlots={showClusterPlots}
          showModelCards={showModelCards}
          onNavigateToCluster={onNavigateToCluster}
          onViewExample={onViewExample}
          method={method}
          misalignedSectionRef={misalignedSectionRef}
          onNavigateToMetric={handleNavigateToMetric}
          onFiltersChange={onFiltersChange || (() => {})}
          availableBehaviorTypes={availableBehaviorTypes || []}
          hasConfidenceIntervals={summary?.has_confidence_intervals || false}
        />
      </Box>
    </Fade>
  );
}

export default MetricsTab;