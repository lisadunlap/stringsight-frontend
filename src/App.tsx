import React, { useState, useCallback, useMemo, useRef, Component } from "react";
import { Box, AppBar, Toolbar, Typography, Container, Button, Drawer, Stack, Accordion, AccordionSummary, AccordionDetails, Pagination, Tabs, Tab, LinearProgress, IconButton, Tooltip, Alert, FormControl, InputLabel, Select, MenuItem, Switch, Menu } from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { detectAndValidate, dfGroupPreview, dfCustom, recomputeClusterMetrics, checkBackendHealth } from "./lib/api";
import { flattenScores, normalizeMetricsColumnNames, enrichModelClusterScoresWithMetadata } from "./lib/normalize";
import { parseFile, inferColumns } from "./lib/parse";
import { detectMethodFromColumns, ensureOpenAIFormat } from "./lib/traces";
import html2pdf from 'html2pdf.js';
import { generatePdfFilename } from './lib/utils';
import DataTable from "./components/DataTable";
import ConversationTrace from "./components/ConversationTrace";
import SideBySideTrace from "./components/SideBySideTrace";
import FormattedCell from "./components/FormattedCell";
import FilterSummary from "./components/FilterSummary";
import PropertyTraceHeader from "./components/PropertyTraceHeader";
// import BenchmarkChart from "./components/BenchmarkChart";
import DataTabBenchmarkTable from "./components/metrics/DataTabBenchmarkTable";

import PropertiesTab from "./components/PropertiesTab";
import FilterBar from "./components/FilterBar";
import PermanentIconSidebar, { type SidebarSection } from "./components/PermanentIconSidebar";
import DataOverviewBanner from "./components/DataOverviewBanner";
import PropertiesOverviewBanner from "./components/PropertiesOverviewBanner";
import DataStatsPanel from "./components/sidebar-sections/DataStatsPanel";
import PropertyExtractionPanel from "./components/sidebar-sections/PropertyExtractionPanel";
// ClusteringPanel removed - clustering now integrated into PropertyExtractionPanel
// ClustersTab kept for viewing cluster results
import ClustersTab from "./components/ClustersTab";
import ClusterSidecard from "./components/ClusterSidecard";
// MetricsPanel removed - now using horizontal filter bar in MetricsTab
import type { MetricsFilters, MetricsSummary } from "./types/metrics";
import { ColumnSelector, type ColumnMapping } from "./components/ColumnSelector";
import { MetricsTab } from "./components/metrics/MetricsTab";
import { getDisplayName } from "./components/metrics/utils/metricUtils";
import type { DataOperation } from "./types/operations";
import { TutorialProvider, useTutorial } from "./context/TutorialContext";
import { createFilterOperation, createCustomCodeOperation, createSortOperation } from "./types/operations";
import { EXTERNAL_LINKS } from "./config";
import { Login } from "./components/Login";
import { LoginDialog } from "./components/LoginDialog";
import { getToken, removeToken } from "./lib/auth";
import LogoutIcon from '@mui/icons-material/Logout';
import { retroColors } from "./theme";
import DemoModeSelector from "./components/DemoModeSelector";




/**
 * Pick a single-model assistant response from a results conversation object.
 * Accepts multiple common aliases. Returns either a string, an array of {role, content}, or empty string.
 */
function pickSingleResponse(c: any): any {
  if (c && Object.prototype.hasOwnProperty.call(c, 'responses')) return c.responses;
  if (c && Object.prototype.hasOwnProperty.call(c, 'response')) return c.response;
  if (c && Object.prototype.hasOwnProperty.call(c, 'model_response')) return c.model_response;
  // Prefer full chat history if provided
  if (Array.isArray(c?.messages)) return c.messages;
  // Common aliases
  if (c && Object.prototype.hasOwnProperty.call(c, 'assistant')) return c.assistant;
  if (c && Object.prototype.hasOwnProperty.call(c, 'output')) return c.output;
  if (c && Object.prototype.hasOwnProperty.call(c, 'completion')) return c.completion;
  if (c && Object.prototype.hasOwnProperty.call(c, 'text')) return c.text;
  return '';
}

/**
 * Pick pair of assistant responses for side-by-side results.
 * Returns a tuple [respA, respB], each can be string or array of {role, content}.
 */
function pickPairResponses(c: any): [any, any] {
  if (Array.isArray(c?.responses) && c.responses.length >= 2) return [c.responses[0], c.responses[1]];
  // Prefer explicit messages arrays per side if present
  if (Array.isArray((c as any)?.messages_a) && Array.isArray((c as any)?.messages_b)) return [(c as any).messages_a, (c as any).messages_b];
  // Common aliases for A/B single strings
  const a = (c as any)?.response_a ?? (c as any)?.assistant_a ?? (c as any)?.output_a ?? (c as any)?.completion_a ?? (c as any)?.text_a ?? '';
  const b = (c as any)?.response_b ?? (c as any)?.assistant_b ?? (c as any)?.output_b ?? (c as any)?.completion_b ?? (c as any)?.text_b ?? '';
  return [a, b];
}

/**
 * Transform operationalRows to backend-expected format.
 * For side-by-side: converts model_a/model_b/score_a/score_b to arrays.
 * For single_model: renames fields to match backend expectations.
 */
function transformRowsForBackend(
  rows: Record<string, any>[],
  method: 'single_model' | 'side_by_side' | 'unknown'
): Record<string, any>[] {
  if (method === 'side_by_side') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt
      };

      // Convert model_a/model_b to model array
      if (row.model_a !== undefined && row.model_b !== undefined) {
        transformed.model = [row.model_a, row.model_b];
      } else if (row.model_a !== undefined) {
        transformed.model = [row.model_a];
      } else if (row.model_b !== undefined) {
        transformed.model = [row.model_b];
      }

      // Convert responses to array
      if (row.model_a_response !== undefined && row.model_b_response !== undefined) {
        transformed.responses = [row.model_a_response, row.model_b_response];
      } else if (row.model_a_response !== undefined) {
        transformed.responses = [row.model_a_response];
      } else if (row.model_b_response !== undefined) {
        transformed.responses = [row.model_b_response];
      }

      // Convert score_a/score_b to scores array
      if (row.score_a !== undefined && row.score_b !== undefined) {
        transformed.scores = [row.score_a, row.score_b];
      } else if (row.score_a !== undefined) {
        transformed.scores = [row.score_a];
      } else if (row.score_b !== undefined) {
        transformed.scores = [row.score_b];
      }

      return transformed;
    });
  } else if (method === 'single_model') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt,
        model: row.model
      };

      // Rename model_response to responses
      if (row.model_response !== undefined) {
        transformed.responses = row.model_response;
      }

      // Rename score to scores
      if (row.score !== undefined) {
        transformed.scores = row.score;
      }

      return transformed;
    });
  }

  // Return as-is for unknown method
  return rows;
}

/**
 * Enrich clusters with per-model quality data from metrics.
 * Extracts quality_by_model and quality_delta_by_model from model_cluster_scores.
 */
function enrichClustersWithQualityData(clusters: any[], modelClusterScores: any[]): any[] {
  if (!clusters || !modelClusterScores || modelClusterScores.length === 0) {
    return clusters;
  }

  // Build a map of cluster identifier -> model -> metrics
  // Note: metrics file may use 'cluster' (label) or 'cluster_id'
  const clusterModelMetrics = new Map<string | number, Map<string, Record<string, number>>>();

  modelClusterScores.forEach(row => {
    // Try both cluster_id and cluster (label) for matching
    const clusterKey = row.cluster_id ?? row.cluster;
    const model = row.model;
    if (clusterKey == null || !model) return;

    if (!clusterModelMetrics.has(clusterKey)) {
      clusterModelMetrics.set(clusterKey, new Map());
    }

    const modelMap = clusterModelMetrics.get(clusterKey)!;
    if (!modelMap.has(model)) {
      modelMap.set(model, {});
    }

    const metrics = modelMap.get(model)!;

    // Extract quality metrics (both absolute and delta)
    // 1) Flat columns: quality_<metric>, quality_delta_<metric>
    Object.keys(row).forEach(key => {
      // quality_{metric} pattern
      const qualityMatch = key.match(/^quality_(.+)$/);
      if (qualityMatch && !key.includes('_delta') && !key.includes('_ci_') && !key.includes('_significant')) {
        const metric = qualityMatch[1];
        if (typeof row[key] === 'number') {
          metrics[metric] = row[key];
        }
      }

      // quality_delta_{metric} pattern
      const deltaMatch = key.match(/^quality_delta_(.+)$/);
      if (deltaMatch && !key.includes('_ci_') && !key.includes('_significant')) {
        const metric = deltaMatch[1];
        if (typeof row[key] === 'number') {
          metrics[`delta_${metric}`] = row[key];
        }
      }
    });

    // 2) Nested objects: quality: {metric: value}, quality_delta: {metric: value}
    if (row.quality && typeof row.quality === 'object') {
      Object.entries(row.quality as Record<string, any>).forEach(([metric, value]) => {
        if (typeof value === 'number') metrics[metric] = value;
      });
    }
    if (row.quality_delta && typeof row.quality_delta === 'object') {
      Object.entries(row.quality_delta as Record<string, any>).forEach(([metric, value]) => {
        if (typeof value === 'number') metrics[`delta_${metric}`] = value;
      });
    }
  });

  // Enrich each cluster
  const enrichedClusters = clusters.map(cluster => {
    // Try matching by both id and label (metrics file uses label as 'cluster')
    let modelMap = clusterModelMetrics.get(cluster.id);
    if (!modelMap || modelMap.size === 0) {
      modelMap = clusterModelMetrics.get(cluster.label);
    }

    if (!modelMap || modelMap.size === 0) {
      return cluster;
    }

    // Build quality_by_model and quality_delta_by_model objects
    const qualityByModel: Record<string, Record<string, number>> = {};
    const qualityDeltaByModel: Record<string, Record<string, number>> = {};

    modelMap.forEach((metrics, model) => {
      qualityByModel[model] = {};
      qualityDeltaByModel[model] = {};

      Object.entries(metrics).forEach(([key, value]) => {
        if (key.startsWith('delta_')) {
          const metric = key.substring(6); // Remove 'delta_' prefix
          qualityDeltaByModel[model][metric] = value;
        } else {
          qualityByModel[model][key] = value;
        }
      });
    });

    // Compute overall quality and quality_delta (averaged across all models)
    const quality: Record<string, number> = {};
    const quality_delta: Record<string, number> = {};

    // Get all unique metric names for quality
    const allMetricNames = new Set<string>();
    Object.values(qualityByModel).forEach(modelMetrics => {
      Object.keys(modelMetrics).forEach(metric => allMetricNames.add(metric));
    });

    // Compute average quality for each metric
    allMetricNames.forEach(metric => {
      const values: number[] = [];
      Object.values(qualityByModel).forEach(modelMetrics => {
        if (typeof modelMetrics[metric] === 'number') {
          values.push(modelMetrics[metric]);
        }
      });
      if (values.length > 0) {
        quality[metric] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    // Get all unique metric names for quality_delta
    const allDeltaMetricNames = new Set<string>();
    Object.values(qualityDeltaByModel).forEach(modelMetrics => {
      Object.keys(modelMetrics).forEach(metric => allDeltaMetricNames.add(metric));
    });

    // Compute average quality_delta for each metric
    allDeltaMetricNames.forEach(metric => {
      const values: number[] = [];
      Object.values(qualityDeltaByModel).forEach(modelMetrics => {
        if (typeof modelMetrics[metric] === 'number') {
          values.push(modelMetrics[metric]);
        }
      });
      if (values.length > 0) {
        quality_delta[metric] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    // Add to cluster meta (now includes overall quality and quality_delta)
    return {
      ...cluster,
      meta: {
        ...(cluster.meta || {}),
        quality_by_model: qualityByModel,
        quality_delta_by_model: qualityDeltaByModel,
        quality,
        quality_delta,
      }
    };
  });

  return enrichedClusters;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Box>
      );
    }

    return <>{this.props.children}</>;
  }
}

/**
 * Component to display tabbed examples of different data format options
 */
function ExampleFormatTabs() {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 2,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem'
          }
        }}
      >
        <Tab label="Conversation Format" />
        <Tab label="Custom Format" />
        <Tab label="Side-by-Side" />
      </Tabs>

      {/* Conversation Format Example */}
      {tabValue === 0 && (
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem' }}>
            <strong>Multi-turn conversations</strong> using OpenAI format with <code>role</code> and <code>content</code> fields.
            Supports tool calls and multimodal inputs.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
            <strong>Fields:</strong>{' '}
            <code style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '2px 4px', borderRadius: '3px' }}>prompt</code>,{' '}
            <code style={{ backgroundColor: '#DBEAFE', color: '#2563EB', padding: '2px 4px', borderRadius: '3px' }}>model</code>,{' '}
            <code style={{ backgroundColor: '#E9D5FF', color: '#9333EA', padding: '2px 4px', borderRadius: '3px' }}>model_response</code>,{' '}
            <code style={{ backgroundColor: '#FED7AA', color: '#EA580C', padding: '2px 4px', borderRadius: '3px' }}>score (optional, can be multiple scores)</code>
            <br />
            <em>Note: You can use any column names you want as long as they correspond to the required fields</em>
          </Typography>
          <Box sx={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1,
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            <Box component="pre" sx={{ m: 0, fontFamily: 'inherit' }}>
              {'[\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"prompt"</span>
              {': "What is the capital of France?",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model"</span>
              {': "gpt-4",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_response"</span>
              {': [\n      {"role": "user", "content": "What is the capital of France?"},\n      {"role": "assistant", "content": "The capital of France is Paris."}\n    ],\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy"</span>
              {': 1.0,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"harmfulness"</span>
              {': 0.0\n  },\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"prompt"</span>
              {': "Explain quantum computing",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model"</span>
              {': "claude-3",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_response"</span>
              {': [\n      {"role": "user", "content": "Explain quantum computing"},\n      {"role": "assistant", "content": "Quantum computing uses..."},\n      {"role": "user", "content": "Can you give an example?"},\n      {"role": "assistant", "content": "Sure! Consider Shor\'s algorithm..."}\n    ],\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy"</span>
              {': 0.8,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"harmfulness"</span>
              {': 0.0\n  }\n]'}
            </Box>
          </Box>
        </Box>
      )}

      {/* Simple Response Format Example */}
      {tabValue === 1 && (
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem' }}>
            <strong>Single string responses</strong> for agentic traces, terminal outputs, or any custom formatted traces. If the model response input is a json object (not in OAI format), we convert it to a string.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
            <strong>Fields:</strong>{' '}
            <code style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '2px 4px', borderRadius: '3px' }}>prompt</code>,{' '}
            <code style={{ backgroundColor: '#DBEAFE', color: '#2563EB', padding: '2px 4px', borderRadius: '3px' }}>model</code>,{' '}
            <code style={{ backgroundColor: '#E9D5FF', color: '#9333EA', padding: '2px 4px', borderRadius: '3px' }}>model_response</code>,{' '}
            <code style={{ backgroundColor: '#FED7AA', color: '#EA580C', padding: '2px 4px', borderRadius: '3px' }}>score (optional, can be multiple scores)</code>
            <br />
            <em>Note: You can use any column names you want as long as they correspond to the required fields</em>
          </Typography>
          <Box sx={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1,
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            <Box component="pre" sx={{ m: 0, fontFamily: 'inherit' }}>
              {'[\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"trace_id"</span>
              {': "chatdev_0",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"llm_name"</span>
              {': "gpt-4.1",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"trajectory"</span>
              {': "[2025-31-03 19:09:41 INFO] **[Preprocessing]**\\n\\n**ChatDev Starts** (20250331190941)\\n\\n**Timestamp**: 20250331190941\\n\\n**config_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/ChatChainConfig.json\\n\\n**config_phase_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/PhaseConfig.json\\n\\n**config_role_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/RoleConfig.json\\n\\n**task_prompt**: Develop a Checkers (Draughts) game. Use an 8x8 board, alternate turns between two players, and apply standard capture and kinging rules [rest of trajectory]",\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"reward"</span>
              {': 1.0,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"code_quality"</span>
              {': 0.7\n  },\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"trace_id"</span>
              {': "chatdev_0",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"llm_name"</span>
              {': "gpt-4.1 w/ ICL prompts",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"trajectory"</span>
              {': "[2025-31-03 19:30:18 INFO] **[Preprocessing]**\\n\\n**ChatDev Starts** (20250331193018)\\n\\n**Timestamp**: 20250331193018\\n\\n**config_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/ChatChainConfig.json\\n\\n**config_phase_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/PhaseConfig.json\\n\\n**config_role_path**: /home/mert/mlsys/ChatDev/CompanyConfig/Prompted/RoleConfig.json\\n\\n**task_prompt**: Develop a Checkers (Draughts) game. Use an 8x8 board, alternate turns between two players, and apply standard capture and kinging rules [rest of trajectory]",\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"reward"</span>
              {': 0.0,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"code_quality"</span>
              {': 0.3\n  }\n]'}
            </Box>
          </Box>
        </Box>
      )}

      {/* Side-by-Side Format Example */}
      {tabValue === 2 && (
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem' }}>
            <strong>Head-to-head model comparisons</strong> with pre-paired responses. Use for A/B testing, arena-style battles, or preference evaluations.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem' }}>
            <strong style={{ textDecoration: 'underline' }}>Alternative:</strong> You can also upload data in conversation or custom format (with <code>prompt</code>, <code>model</code>, <code>model_response</code>, <code>score</code>) and select which models to compare in the UI by changing "Comparison Method" to "Side-by-Side" in the Column Selector.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
            <strong>Fields:</strong>{' '}
            <code style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '2px 4px', borderRadius: '3px' }}>prompt</code>,{' '}
            <code style={{ backgroundColor: '#DBEAFE', color: '#2563EB', padding: '2px 4px', borderRadius: '3px' }}>model_a</code>,{' '}
            <code style={{ backgroundColor: '#DBEAFE', color: '#2563EB', padding: '2px 4px', borderRadius: '3px' }}>model_b</code>,{' '}
            <code style={{ backgroundColor: '#E9D5FF', color: '#9333EA', padding: '2px 4px', borderRadius: '3px' }}>model_a_response</code>,{' '}
            <code style={{ backgroundColor: '#E9D5FF', color: '#9333EA', padding: '2px 4px', borderRadius: '3px' }}>model_b_response</code>,{' '}
            <br />
            <em>Note: You can use any column names you want as long as they correspond to the required fields</em>
          </Typography>
          <Box sx={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1,
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            <Box component="pre" sx={{ m: 0, fontFamily: 'inherit' }}>
              {'[\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"prompt"</span>
              {': "What is machine learning?",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model_a"</span>
              {': "gpt-4",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model_b"</span>
              {': "claude-3",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_a_response"</span>
              {': "ML is a subset of AI that enables systems to learn from data...",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_b_response"</span>
              {': "Machine learning involves algorithms that improve through experience...",\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy_a"</span>
              {': 0.95,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy_b"</span>
              {': 0.92,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"helpfulness_a"</span>
              {': 4.5,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"helpfulness_b"</span>
              {': 4.3\n  },\n  {\n    '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>"prompt"</span>
              {': "Explain quantum computing",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model_a"</span>
              {': "gpt-4",\n    '}
              <span style={{ color: '#2563EB', fontWeight: 600 }}>"model_b"</span>
              {': "claude-3",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_a_response"</span>
              {': "Quantum computing uses quantum bits...",\n    '}
              <span style={{ color: '#9333EA', fontWeight: 600 }}>"model_b_response"</span>
              {': "QC leverages quantum mechanical phenomena...",\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy_a"</span>
              {': 0.88,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"accuracy_b"</span>
              {': 0.91,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"helpfulness_a"</span>
              {': 4.0,\n    '}
              <span style={{ color: '#EA580C', fontWeight: 600 }}>"helpfulness_b"</span>
              {': 4.6\n  }\n]'}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());

  // Data management layers as suggested
  const [originalRows, setOriginalRows] = useState<Record<string, any>[]>([]); // Raw uploaded data
  const [uploadedFileName, setUploadedFileName] = useState<string>(''); // Original file name without extension
  const [resultsName, setResultsName] = useState<string>(''); // Custom name for results folder (defaults to uploadedFileName)
  const [operationalRows, setOperationalRows] = useState<Record<string, any>[]>([]); // Cleaned, filtered columns
  const [currentRows, setCurrentRows] = useState<Record<string, any>[]>([]); // With filters applied

  const [method, setMethod] = useState<"single_model" | "side_by_side" | "unknown">("unknown");

  const handleLogout = () => {
    removeToken();
    setIsAuthenticated(false);
    // Reset state
    setOriginalRows([]);
    setOperationalRows([]);
    setCurrentRows([]);
    setPropertiesRows([]);
    setClusters([]);
    setIsDemoSession(false); // Added
  };
  // Login dialog state
  const [loginOpen, setLoginOpen] = useState(false);

  // Demo mode selector dialog state
  const [demoModeSelectorOpen, setDemoModeSelectorOpen] = useState(false);
  const [isDemoSession, setIsDemoSession] = useState(false); // Added

  // Results load menu state
  const [resultsMenuAnchor, setResultsMenuAnchor] = useState<null | HTMLElement>(null);

  // ... rest of the component ...
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const traceContentRef = useRef<HTMLDivElement>(null);
  const appBarRef = useRef<HTMLDivElement>(null);
  const propertiesSectionRef = useRef<HTMLDivElement>(null);
  const [appBarHeight, setAppBarHeight] = useState<number>(64); // Default toolbar height

  // Use refs for values that callbacks need to read but shouldn't trigger recreation
  const operationalRowsRef = useRef<Record<string, any>[]>([]);
  const methodRef = useRef<"single_model" | "side_by_side" | "unknown">("unknown");

  // Update refs when state changes
  React.useEffect(() => {
    operationalRowsRef.current = operationalRows;
  }, [operationalRows]);

  React.useEffect(() => {
    methodRef.current = method;
  }, [method]);

  const [selectedTrace, setSelectedTrace] = useState<any>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [selectedRowForExtraction, setSelectedRowForExtraction] = useState<Record<string, any> | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<string[] | null>(null);
  const [evidenceTargetModel, setEvidenceTargetModel] = useState<string | undefined>(undefined);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null); // Track the property when viewing from properties table
  const [propertiesByKey, setPropertiesByKey] = useState<Map<string, any[]>>(new Map());
  const [propertiesRows, setPropertiesRows] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<SidebarSection>('data');
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  const [hasViewedClusters, setHasViewedClusters] = useState<boolean>(false);
  const [clusterSearchQuery, setClusterSearchQuery] = useState<string>('');

  // Cluster sidecard state
  const [clusterSidecardOpen, setClusterSidecardOpen] = useState<boolean>(false);
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null);

  // Highlight extraction icon when data is loaded but no properties exist
  const [highlightExtractionIcon, setHighlightExtractionIcon] = useState<boolean>(false);

  // Results loading indicator
  const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false);
  const [resultsLoadingMessage, setResultsLoadingMessage] = useState<string>('');
  const [resultsError, setResultsError] = useState<string | null>(null);
  // -------- Clustering State ---------
  const [clusters, setClusters] = useState<any[]>([]);
  const [totalConversationsByModel, setTotalConversationsByModel] = useState<Record<string, number> | null>(null);
  const [totalUniqueConversations, setTotalUniqueConversations] = useState<number | null>(null);
  const [clusteringAlertDismissed, setClusteringAlertDismissed] = useState<boolean>(false);
  const [clusteringJustCompleted, setClusteringJustCompleted] = useState<boolean>(false);
  // Results mode (when loading full_dataset.json)
  const [isResultsMode, setIsResultsMode] = useState<boolean>(false);
  const [resultsMetrics, setResultsMetrics] = useState<{ model_cluster_scores?: any; cluster_scores?: any; model_scores?: any } | null>(null);
  // Removed explainBusy (no separate panel submit)
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);

  // -------- Display Settings ---------
  const [decimalPrecision, setDecimalPrecision] = useState<number>(2);

  // -------- Metrics Tab State ---------
  const [metricsFilters, setMetricsFilters] = useState<MetricsFilters>({
    selectedModels: [],
    selectedMetrics: [],
    selectedGroups: [],
    selectedBehaviorTypes: [],
    qualityMetric: '',
    sortBy: 'proportion_delta_desc',
    topN: 5,
    significanceOnly: false,
    showCI: false,
  });

  // Benchmark view mode for data tab
  const [benchmarkViewMode, setBenchmarkViewMode] = useState<'table' | 'graph'>('table');
  const [availableQualityMetrics, setAvailableQualityMetrics] = useState<string[]>([]);

  // Metrics data for sidebar
  const [metricsAvailableModels, setMetricsAvailableModels] = useState<string[]>([]);
  const [metricsAvailableGroups, setMetricsAvailableGroups] = useState<string[]>([]);
  const [metricsAvailableQualityMetrics, setMetricsAvailableQualityMetrics] = useState<string[]>([]);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);

  // Reset metrics filters when new data is loaded
  React.useEffect(() => {
    if (resultsMetrics) {
      // Reset filters to defaults when new data is loaded
      // Note: selectedBehaviorTypes will be set by onDataProcessed to exclude 'positive' by default
      setMetricsFilters({
        selectedModels: [],
        selectedMetrics: [],
        selectedGroups: [],
        selectedBehaviorTypes: [], // Will be auto-populated by onDataProcessed to exclude 'positive'
        qualityMetric: '',
        sortBy: 'proportion_delta_desc',
        topN: 5,
        significanceOnly: false,
        showCI: false,
      });
      // Clear previous metrics metadata
      setMetricsAvailableModels([]);
      setMetricsAvailableGroups([]);
      setMetricsAvailableQualityMetrics([]);
      setMetricsSummary(null);
    }
  }, [resultsMetrics]);

  // Demo mode: Check if demo mode is enabled (backend operations will be limited to 100 rows)
  const isDemoMode = import.meta.env.VITE_DEMO === 'true';
  const demoSampleSize = 100;

  // (demo banner removed)

  // Highlight extraction icon when data is loaded but no properties exist
  React.useEffect(() => {
    if (operationalRows.length > 0 && propertiesRows.length === 0 && !isLoadingResults) {
      // Flash for 10 seconds
      setHighlightExtractionIcon(true);
      const timer = setTimeout(() => {
        setHighlightExtractionIcon(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else if (propertiesRows.length > 0) {
      // Turn off immediately when properties are added
      setHighlightExtractionIcon(false);
    }
  }, [operationalRows.length, propertiesRows.length, isLoadingResults]);

  // (reserved) keying strategies for recomputes can be added later when needed

  // Remove auto-recompute; metrics will be explicitly recomputed by the ClustersTab when filters change
  const [batchRunning, setBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [batchState, setBatchState] = useState<string | null>(null);
  type PipelineStage = 'idle' | 'extraction' | 'clustering';
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');

  // Flexible column mapping state
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [autoDetectedMapping, setAutoDetectedMapping] = useState<ColumnMapping | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null); // reserved for future use
  const [mappingValid, setMappingValid] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]); // reserved for future validation UI
  const [filterNotice, setFilterNotice] = useState<string | null>(null);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsInputRef = useRef<HTMLInputElement>(null);
  const resultsZipInputRef = useRef<HTMLInputElement>(null);

  // Backend availability check on mount
  React.useEffect(() => {
    (async () => {
      const ok = await checkBackendHealth();
      setBackendAvailable(ok);
    })();
  }, []);

  // PDF download handler for drawer traces
  const handleDrawerPrint = () => {
    if (!traceContentRef.current) return;

    const promptText = selectedRow?.prompt ? String(selectedRow.prompt) : '';
    const filename = promptText ? generatePdfFilename(promptText) : 'conversation_trace.pdf';

    const opt: any = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(traceContentRef.current).save();
  };

  // Click-outside handler for drawer - close drawer when clicking outside, but not when clicking in the sidebar
  React.useEffect(() => {
    if (!drawerOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is inside the drawer
      if (drawerRef.current?.contains(target)) {
        return;
      }

      // Check if click is inside the expanded sidebar (left: 60px, width: 400px when expanded)
      if (sidebarExpanded) {
        const rect = target.getBoundingClientRect();
        const clickX = event.clientX;
        // Sidebar spans from 60px to 460px when expanded
        if (clickX >= 60 && clickX <= 460) {
          return;
        }
      }

      // Click is outside both drawer and sidebar - close drawer
      setDrawerOpen(false);
      setSelectedTrace(null);
      setSelectedRow(null);
      setSelectedEvidence(null);
      setEvidenceTargetModel(undefined);
      setSelectedProperty(null);
    };

    // Add listener with slight delay to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [drawerOpen, sidebarExpanded]);

  // Measure AppBar height to account for dynamic content (progress bar, clustering message)
  React.useEffect(() => {
    const updateAppBarHeight = () => {
      if (appBarRef.current) {
        setAppBarHeight(appBarRef.current.offsetHeight);
      }
    };

    // Initial measurement
    updateAppBarHeight();

    // Update on window resize and when relevant state changes
    window.addEventListener('resize', updateAppBarHeight);

    // Use a small delay to ensure DOM has updated
    const timeoutId = setTimeout(updateAppBarHeight, 100);

    return () => {
      window.removeEventListener('resize', updateAppBarHeight);
      clearTimeout(timeoutId);
    };
  }, [batchRunning, clusters.length, pipelineStage, batchState, batchProgress, clusteringAlertDismissed]);

  // Reset UI, panels, and tabs when a brand new source is loaded
  const resetUiStateForNewSource = React.useCallback((mode: 'file' | 'results') => {
    // Core data and mapping
    setOriginalRows([]);
    setUploadedFileName(''); // Reset filename when switching data sources
    setResultsName(''); // Reset results name when switching data sources
    setOperationalRows([]);
    setCurrentRows([]);
    setAvailableColumns([]);
    setAutoDetectedMapping(null);
    setColumnMapping(null);
    setFilterNotice(null);
    setMethod('unknown');
    setIsResultsMode(mode === 'results');
    setResultsMetrics(null);
    setHasViewedClusters(false); // Added
    setIsDemoSession(false); // Added
    setUploadedFileName(''); // Added
    setResultsName(''); // Added
    setResultsError(null); // Added
    // Hide column selector when loading results (results are already in correct format)
    if (mode === 'results') {
      setShowColumnSelector(false);
    }

    // Panels and sidebar
    setActiveSection('data');
    setHasViewedClusters(false);
    setSidebarExpanded(false);

    // Drawer and selections
    setDrawerOpen(false);
    setSelectedTrace(null);
    setSelectedRow(null);
    setSelectedRowForExtraction(null);
    setSelectedEvidence(null);
    setEvidenceTargetModel(undefined);
    setSelectedProperty(null);

    // Properties and clusters
    setPropertiesByKey(new Map());
    setPropertiesRows([]);
    setClusters([]);
    setClusteringAlertDismissed(false);

    // Operations, filters, grouping, sorting
    setOperationChain([]);
    setGroupBy(null);
    setGroupPreview([]);
    setExpandedGroup(null);
    setGroupRows([]);
    setGroupTotal(0);
    setGroupPagination(new Map());
    setSortColumn(null);
    setSortDirection(null);
    setDataSearchQuery('');

    // Custom code sandbox
    setCustomCode("");
    setCustomError(null);
  }, []);

  // Reuse: prepare UI to map columns for a newly provided dataset
  const applyAutoMappingFromColumns = React.useCallback((columns: string[]) => {
    // Try to auto-detect column mapping using legacy method as fallback
    const legacyDetected = detectMethodFromColumns(columns);

    // Create auto-detected mapping based on legacy detection and available columns
    const autoMapping: ColumnMapping = {
      promptCol: columns.find(c => c.toLowerCase() === 'prompt') || '',
      responseCols: legacyDetected === 'side_by_side'
        ? columns.filter(c => c.includes('model_a_response') || c.includes('model_b_response'))
        : columns.filter(c => c.includes('model_response')),
      modelCols: legacyDetected === 'side_by_side'
        ? columns.filter(c => (c.includes('model_a') || c.includes('model_b')) && !c.includes('response'))
        : columns.filter(c => c.toLowerCase() === 'model'),
      scoreCols: columns.filter(c => c.toLowerCase().includes('score')),
      method: legacyDetected === 'unknown' ? 'single_model' : legacyDetected
    };

    setAutoDetectedMapping(autoMapping);

    // Always show the column selector after new data is provided
    setShowColumnSelector(true);
    setMethod('unknown');
    setOperationalRows([]);
    setCurrentRows([]);
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Assume a completely different source; reset panels and tabs
    resetUiStateForNewSource('file');
    setIsLoadingResults(true);
    setResultsLoadingMessage('Parsing file and preparing data...');

    try {
      // Parse the file
      const { rows, columns } = await parseFile(file);

      // Store raw data and columns
      setOriginalRows(rows);
      setAvailableColumns(columns);
      setFilterNotice(null);

      // Store file name without extension for use in results folder naming
      const fileNameWithoutExt = file.name.replace(/\.(csv|json|jsonl)$/i, '');
      setUploadedFileName(fileNameWithoutExt);
      setResultsName(fileNameWithoutExt);

      // Prepare UI to select mapping for these columns
      applyAutoMappingFromColumns(columns);

      try {
        await detectAndValidate(file); // optional backend validation
      } catch (_) { }
    } catch (e: any) {
      console.error('❌ Failed to parse file:', e);
      setResultsError(String(e?.message || e));
    } finally {
      setIsLoadingResults(false);
      setResultsLoadingMessage('');
      // Reset file input so the same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const tutorial = useTutorial();

  // When the demo-data tutorial reaches the "extract trace" step, automatically
  // switch to the Extraction section so users see where to run property extraction.
  React.useEffect(() => {
    if (!tutorial || !tutorial.activeTutorialId || !tutorial.steps) return;
    const step = tutorial.steps[tutorial.currentStepIndex];
    if (tutorial.activeTutorialId === 'demo-data' && step && step.id === 'demo-step-2-extract-trace') {
      setActiveSection('extraction');
      setSidebarExpanded(true);
    }
  }, [tutorial, setActiveSection, setSidebarExpanded]);

  // Load demo dataset from a bundled JSONL file and reuse the same flow as upload
  const onLoadDemoData = React.useCallback(async (selectedMode: 'single_model' | 'side_by_side') => {
    // Treat as a new source
    resetUiStateForNewSource('file');
    setIsLoadingResults(true);
    setResultsLoadingMessage('Loading demo data...');

    try {
      // Choose file based on selected mode
      const demoFileName = selectedMode === 'side_by_side'
        ? 'taubench_airline_sbs.jsonl'
        : 'taubench_airline.jsonl';

      // Fetch from public root; ensure file exists at public/taubench_airline.jsonl or public/taubench_airline_sbs.jsonl
      const res = await fetch(`/${demoFileName}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch demo data (HTTP ${res.status})`);
      }
      const text = await res.text();
      const rows = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          // Some demo lines may have a leading token like "can " before the JSON begins
          const brace = l.indexOf('{');
          const jsonStr = brace > 0 ? l.slice(brace) : l;
          return JSON.parse(jsonStr);
        });

      // Infer columns using same util as parseFile
      const columns = inferColumns(rows);

      // Store raw data and columns
      setOriginalRows(rows);
      setAvailableColumns(columns);
      setFilterNotice(null);

      // Set filename for demo data
      const baseFileName = selectedMode === 'side_by_side' ? 'taubench_airline_sbs' : 'taubench_airline';
      setUploadedFileName(baseFileName);
      setResultsName(baseFileName);
      setIsDemoSession(true); // Added

      // Create mapping based on user-selected mode
      const autoMapping: ColumnMapping = {
        promptCol: columns.find(c => c.toLowerCase() === 'prompt') || '',
        responseCols: selectedMode === 'side_by_side'
          ? [
            columns.find(c => c.includes('model_a_response')) || '',
            columns.find(c => c.includes('model_b_response')) || ''
          ].filter(Boolean)
          : columns.filter(c => c === 'model_response'),
        modelCols: selectedMode === 'side_by_side'
          ? [
            columns.find(c => c.includes('model_a') && !c.includes('response')) || '',
            columns.find(c => c.includes('model_b') && !c.includes('response')) || ''
          ].filter(Boolean)
          : columns.filter(c => c.toLowerCase() === 'model'),
        scoreCols: columns.filter(c => c.toLowerCase().includes('score')),
        method: selectedMode
      };
      setAutoDetectedMapping(autoMapping);

      // Automatically apply the mapping and process data (skip column selector for demo data)
      processDataWithMapping(rows, autoMapping);
      setShowColumnSelector(false);

      // Ensure the viewport is at the top of the main tab when demo data loads,
      // so users see the table header and controls without needing to scroll.
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      // Start (or restart) the demo-data tutorial once demo data has loaded.
      // This ensures the guided walkthrough appears every time the user clicks "Start Demo",
      // even if they previously completed or skipped it.
      if (tutorial) {
        tutorial.startTutorial('demo-data');
      }
    } catch (e: any) {
      setResultsError(String(e?.message || e));
    } finally {
      setIsLoadingResults(false);
      setResultsLoadingMessage('');
    }
  }, [resetUiStateForNewSource, applyAutoMappingFromColumns, tutorial]);

  // Load results from local folder
  const onLoadResultsLocal = React.useCallback(async (files: FileList) => {
    resetUiStateForNewSource('results');
    setIsLoadingResults(true);
    setResultsLoadingMessage('Loading results from local folder...');

    try {
      // Parse all JSON/JSONL files from the folder
      const fileArray = Array.from(files);
      const jsonFiles = fileArray.filter(f => f.name.endsWith('.json') || f.name.endsWith('.jsonl'));

      console.log('📁 All files in folder:', fileArray.map(f => f.name));
      console.log('📄 JSON/JSONL files found:', jsonFiles.map(f => f.name));

      if (jsonFiles.length === 0) {
        throw new Error('No JSON or JSONL files found in selected folder');
      }

      let conversations: any[] = [];
      let properties: any[] = [];
      let clusters: any[] = [];
      let metrics: any = null;

      // Load each file based on name
      for (const file of jsonFiles) {
        const text = await file.text();
        const name = file.name.toLowerCase();

        console.log(`🔍 Processing file: ${file.name} (${text.length} bytes)`);

        try {
          if (name === 'conversation.jsonl' || name === 'conversations.jsonl') {
            // Primary formats: conversation.jsonl or conversations.jsonl
            const lines = text.split('\n').filter(l => l.trim());
            conversations = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${conversations.length} conversations from ${file.name}`);
            console.log(`📊 Sample conversation:`, conversations[0]);
          } else if (name === 'full_dataset.json' || name === 'conversations.json') {
            // Only load if we don't already have conversations from .jsonl files
            if (conversations.length > 0) {
              console.log(`⏭️ Skipping ${file.name} - already loaded conversations from .jsonl file`);
              continue;
            }

            const data = JSON.parse(text);

            // Handle different data structures
            if (Array.isArray(data)) {
              conversations = data;
            } else if (data && typeof data === 'object') {
              // Extract conversations
              if (Array.isArray(data.conversations)) {
                conversations = data.conversations;
              } else if (Array.isArray(data.data)) {
                conversations = data.data;
              } else if (Array.isArray(data.rows)) {
                conversations = data.rows;
              } else if (Array.isArray(data.results)) {
                conversations = data.results;
              } else {
                // If it's a single object, wrap it in an array
                conversations = [data];
              }

              // Also extract properties and clusters from full_dataset.json
              if (Array.isArray(data.properties) && properties.length === 0) {
                properties = data.properties;
                console.log(`✅ Loaded ${properties.length} properties from ${file.name}`);
              }
              if (Array.isArray(data.clusters) && clusters.length === 0) {
                clusters = data.clusters;
                console.log(`✅ Loaded ${clusters.length} clusters from ${file.name}`);
              }
            }

            console.log(`✅ Loaded ${conversations.length} conversations from ${file.name}`);
            console.log(`📊 Sample conversation:`, conversations[0]);
            console.log(`📊 Sample conversation keys:`, Object.keys(conversations[0] || {}));
          } else if (name === 'properties.jsonl') {
            // New primary format: properties.jsonl
            const lines = text.split('\n').filter(l => l.trim());
            properties = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${properties.length} properties from ${file.name}`);
          } else if (name === 'parsed_properties.jsonl') {
            // Legacy format fallback
            if (properties.length === 0) {
              const lines = text.split('\n').filter(l => l.trim());
              properties = lines.map(line => JSON.parse(line));
              console.log(`✅ Loaded ${properties.length} properties from ${file.name} (legacy format)`);
            }
          } else if (name === 'clusters.jsonl') {
            // New primary format: clusters.jsonl
            const lines = text.split('\n').filter(l => l.trim());
            clusters = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${clusters.length} clusters from ${file.name}`);
          } else if (name === 'model_cluster_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.model_cluster_scores = scores;
            console.log(`✅ Loaded ${scores.length} model_cluster_scores from ${file.name}`);
          } else if (name === 'cluster_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.cluster_scores = scores;
            console.log(`✅ Loaded ${scores.length} cluster_scores from ${file.name}`);
          } else if (name === 'model_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.model_scores = scores;
            console.log(`✅ Loaded ${scores.length} model_scores from ${file.name}`);
          } else {
            console.log(`⚠️ Skipping unrecognized file: ${file.name}`);
          }
        } catch (e) {
          console.error(`❌ Failed to parse ${file.name}:`, e);
          throw new Error(`Failed to parse ${file.name}: ${e}`);
        }
      }

      if (conversations.length === 0) {
        throw new Error('No conversation data found. Expected file named "conversation.jsonl", "conversations.jsonl", "full_dataset.json", or "conversations.json"');
      }

      // Set up conversations with three-layer data structure
      console.log('🔧 Processing conversations...');
      const columns = inferColumns(conversations);
      console.log('📋 Detected columns:', columns);

      // Detect method from columns
      const detectedMethod = detectMethodFromColumns(columns);
      console.log('🎯 Detected method:', detectedMethod);
      setMethod(detectedMethod);

      // Layer 1: originalRows - keep raw format for PropertiesTab enrichment
      setOriginalRows(conversations);
      setAvailableColumns(columns);

      // Layer 2: operationalRows - map to backend format with score objects
      // conversation.jsonl already has scores as objects, so just add __index
      const operational = conversations.map((conv, idx) => ({
        __index: idx,
        question_id: conv.question_id,
        prompt: conv.prompt,

        // Single model fields
        ...(conv.model && {
          model: conv.model,
          model_response: conv.model_response,
          score: conv.score  // Already an object in conversation.jsonl
        }),

        // Side-by-side fields
        ...(conv.model_a && {
          model_a: conv.model_a,
          model_b: conv.model_b,
          model_a_response: conv.model_a_response,
          model_b_response: conv.model_b_response,
          score_a: conv.score_a,  // Already an object
          score_b: conv.score_b   // Already an object
        })
      }));

      console.log('🔧 DEBUG: Setting operationalRows:', {
        count: operational.length,
        sampleRow: operational[0],
        method: detectedMethod,
        hasScores: operational[0]?.score || operational[0]?.score_a || operational[0]?.score_b
      });
      setOperationalRows(operational);

      // Layer 3: currentRows - flatten scores for DataTable display
      const modelNames = detectedMethod === 'side_by_side' && operational.length > 0
        ? { modelA: operational[0]?.model_a, modelB: operational[0]?.model_b }
        : undefined;

      const { rows: flattened, columns: flattenedColumns } = flattenScores(operational, detectedMethod, modelNames);
      console.log('📊 DEBUG: After flattening:', {
        outputRows: flattened.length,
        sampleOutputRow: flattened[0],
        columns: flattenedColumns,
        scoreColumns: flattenedColumns.filter(c => c.startsWith('score_'))
      });
      setCurrentRows(flattened);

      // Hide column selector since results are already in the correct format
      setShowColumnSelector(false);

      // Load properties (no pre-enrichment needed - PropertiesTab handles at render time)
      // Don't add __index since property index doesn't match conversation index
      if (properties.length > 0) {
        setPropertiesRows(properties);
        console.log(`✅ Loaded ${properties.length} properties`);
      }

      // Load or compute metrics and enrich clusters
      if (clusters.length > 0) {
        if (Object.keys(metrics).length > 0) {
          // Use pre-computed metrics if available
          const normalizedMetrics = normalizeMetricsColumnNames(metrics);
          console.log('✅ Using pre-computed metrics:', Object.keys(normalizedMetrics));

          // Enrich model_cluster_scores with cluster metadata (meta.group)
          if (normalizedMetrics.model_cluster_scores) {
            normalizedMetrics.model_cluster_scores = enrichModelClusterScoresWithMetadata(
              normalizedMetrics.model_cluster_scores,
              clusters
            );
          }

          setResultsMetrics(normalizedMetrics);

          if (normalizedMetrics.model_cluster_scores) {
            const enrichedClusters = enrichClustersWithQualityData(
              clusters,
              normalizedMetrics.model_cluster_scores
            );
            setClusters(ensureExamplesArray(enrichedClusters));
            console.log(`✅ Loaded ${enrichedClusters.length} clusters (enriched with pre-computed metrics)`);
          }
        } else if (conversations.length > 0 && properties.length > 0) {
          // Compute metrics on-the-fly from raw data
          console.log('🔢 Computing metrics on-the-fly from conversations + properties + clusters');
          console.log('🔢 Data available:', {
            conversations: conversations.length,
            operational: operational.length,
            properties: properties.length,
            clusters: clusters.length
          });

          try {
            const { computeClusterMetrics } = await import('./lib/clusterMetrics');

            const clusterMetrics = computeClusterMetrics(
              operational, // Use operational rows which have score objects
              properties,
              clusters
            );

            console.log('🔢 Computed metrics for clusters:', clusterMetrics.length);
            console.log('🔢 Sample cluster metrics:', clusterMetrics[0]);

            // Enrich clusters with computed metrics
            const enrichedClusters = clusters.map(cluster => {
              const metrics = clusterMetrics.find(m => String(m.cluster_id) === String(cluster.id));
              if (!metrics) {
                console.warn('⚠️ No metrics found for cluster:', cluster.id);
                return cluster;
              }

              console.log(`📊 Enriching cluster ${cluster.label} with:`, {
                quality_delta_by_model: metrics.quality_delta_by_model,
                total_unique_conversations: metrics.total_unique_conversations
              });

              return {
                ...cluster,
                meta: {
                  ...cluster.meta,
                  proportion_overall: metrics.proportion_overall,
                  proportion_by_model: metrics.proportion_by_model,
                  quality_by_model: metrics.quality_by_model,
                  quality_delta_by_model: metrics.quality_delta_by_model,
                  total_unique_conversations: metrics.total_unique_conversations
                }
              };
            });

            setClusters(ensureExamplesArray(enrichedClusters));
            console.log(`✅ Loaded ${enrichedClusters.length} clusters (enriched with computed metrics)`);
            console.log('✅ Sample enriched cluster meta:', enrichedClusters[0]?.meta);
          } catch (error) {
            console.error('❌ Error computing cluster metrics:', error);
            setClusters(ensureExamplesArray(clusters));
            console.log(`⚠️ Loaded ${clusters.length} clusters without metrics due to error`);
          }
        } else {
          // No metrics and can't compute - load clusters without enrichment
          setClusters(ensureExamplesArray(clusters));
          console.log(`✅ Loaded ${clusters.length} clusters (no metrics available)`);
        }
      }

      // Switch to appropriate view based on loaded data
      if (clusters.length > 0 && Object.keys(metrics).length > 0) {
        setActiveSection('metrics');
        console.log('📊 Switched to Metrics view');
      } else if (clusters.length > 0) {
        setActiveSection('clusters');
        console.log('📊 Switched to Clusters view');
      } else if (properties.length > 0) {
        setActiveSection('extraction');
        console.log('📊 Switched to Properties view');
      } else {
        setActiveSection('data');
        console.log('📊 Staying on Data view');
      }

      console.log('✅ Results loaded successfully:', {
        conversations: conversations.length,
        properties: properties.length,
        clusters: clusters.length,
        hasMetrics: !!metrics
      });

    } catch (e: any) {
      console.error('❌ Failed to load results:', e);
      setResultsError(String(e?.message || e));
    } finally {
      setIsLoadingResults(false);
      setResultsLoadingMessage('');
      // Reset file input so the same folder can be loaded again
      if (resultsInputRef.current) {
        resultsInputRef.current.value = '';
      }
    }
  }, [resetUiStateForNewSource, processDataWithMapping]);

  // Load results from zip file
  const onLoadResultsZip = React.useCallback(async (file: File) => {
    resetUiStateForNewSource('results');
    setIsLoadingResults(true);
    setResultsLoadingMessage('Extracting and loading results from zip file...');

    // Helper to ensure examples is always an array
    const ensureExamples = (cs: any[]) => (cs || []).map((c: any) => ({ ...c, examples: c.examples || [] }));

    try {
      // Extract zip file
      let zip: JSZip;
      let zipContents: JSZip;
      try {
        zip = new JSZip();
        zipContents = await zip.loadAsync(file);
      } catch (e: any) {
        throw new Error(`Invalid zip file. Please ensure you're uploading a valid .zip file. Error: ${e?.message || 'Unknown error'}`);
      }

      console.log('📦 Zip file contents:', Object.keys(zipContents.files));

      // Convert zip files to File-like objects for processing
      const fileArray: File[] = [];
      for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
        // Skip directories
        if (zipEntry.dir) continue;

        // Get file content as blob
        const blob = await zipEntry.async('blob');
        // Create a File-like object with the original filename
        const file = new File([blob], filename.split('/').pop() || filename, { type: 'application/json' });
        fileArray.push(file);
      }

      // Filter JSON/JSONL files
      const jsonFiles = fileArray.filter(f => f.name.endsWith('.json') || f.name.endsWith('.jsonl'));

      console.log('📄 JSON/JSONL files found in zip:', jsonFiles.map(f => f.name));

      if (jsonFiles.length === 0) {
        const allFiles = Object.keys(zipContents.files).filter(f => !zipContents.files[f].dir);
        throw new Error(
          `No JSON or JSONL files found in zip file.\n\n` +
          `Found files: ${allFiles.length > 0 ? allFiles.join(', ') : 'none'}\n\n` +
          `Expected files:\n` +
          `- conversation.jsonl or conversations.jsonl (required)\n` +
          `- properties.jsonl (optional)\n` +
          `- clusters.jsonl (optional)\n` +
          `- model_cluster_scores_df.jsonl (optional)\n` +
          `- cluster_scores_df.jsonl (optional)\n` +
          `- model_scores_df.jsonl (optional)`
        );
      }

      let conversations: any[] = [];
      let properties: any[] = [];
      let clusters: any[] = [];
      let metrics: any = null;

      // Load each file based on name (same logic as onLoadResultsLocal)
      for (const file of jsonFiles) {
        const text = await file.text();
        const name = file.name.toLowerCase();

        console.log(`🔍 Processing file: ${file.name} (${text.length} bytes)`);

        try {
          if (name === 'conversation.jsonl' || name === 'conversations.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            conversations = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${conversations.length} conversations from ${file.name}`);
            console.log(`📊 Sample conversation:`, conversations[0]);
          } else if (name === 'full_dataset.json' || name === 'conversations.json') {
            if (conversations.length > 0) {
              console.log(`⏭️ Skipping ${file.name} - already loaded conversations from .jsonl file`);
              continue;
            }

            const data = JSON.parse(text);

            if (Array.isArray(data)) {
              conversations = data;
            } else if (data && typeof data === 'object') {
              if (Array.isArray(data.conversations)) {
                conversations = data.conversations;
              } else if (Array.isArray(data.data)) {
                conversations = data.data;
              } else if (Array.isArray(data.rows)) {
                conversations = data.rows;
              } else if (Array.isArray(data.results)) {
                conversations = data.results;
              } else {
                conversations = [data];
              }

              if (Array.isArray(data.properties) && properties.length === 0) {
                properties = data.properties;
                console.log(`✅ Loaded ${properties.length} properties from ${file.name}`);
              }
              if (Array.isArray(data.clusters) && clusters.length === 0) {
                clusters = data.clusters;
                console.log(`✅ Loaded ${clusters.length} clusters from ${file.name}`);
              }
            }

            console.log(`✅ Loaded ${conversations.length} conversations from ${file.name}`);
            console.log(`📊 Sample conversation:`, conversations[0]);
            console.log(`📊 Sample conversation keys:`, Object.keys(conversations[0] || {}));
          } else if (name === 'properties.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            properties = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${properties.length} properties from ${file.name}`);
          } else if (name === 'parsed_properties.jsonl') {
            if (properties.length === 0) {
              const lines = text.split('\n').filter(l => l.trim());
              properties = lines.map(line => JSON.parse(line));
              console.log(`✅ Loaded ${properties.length} properties from ${file.name} (legacy format)`);
            }
          } else if (name === 'clusters.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            clusters = lines.map(line => JSON.parse(line));
            console.log(`✅ Loaded ${clusters.length} clusters from ${file.name}`);
          } else if (name === 'model_cluster_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.model_cluster_scores = scores;
            console.log(`✅ Loaded ${scores.length} model_cluster_scores from ${file.name}`);
          } else if (name === 'cluster_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.cluster_scores = scores;
            console.log(`✅ Loaded ${scores.length} cluster_scores from ${file.name}`);
          } else if (name === 'model_scores_df.jsonl') {
            const lines = text.split('\n').filter(l => l.trim());
            const scores = lines.map(line => JSON.parse(line));
            if (!metrics) metrics = {};
            metrics.model_scores = scores;
            console.log(`✅ Loaded ${scores.length} model_scores from ${file.name}`);
          } else {
            console.log(`⚠️ Skipping unrecognized file: ${file.name}`);
          }
        } catch (e: any) {
          console.error(`❌ Failed to parse ${file.name}:`, e);
          const errorMsg = e?.message || String(e);
          throw new Error(
            `Failed to parse file "${file.name}" in zip.\n\n` +
            `Error: ${errorMsg}\n\n` +
            `Please ensure the file is valid JSON or JSONL format.`
          );
        }
      }

      if (conversations.length === 0) {
        const foundFiles = jsonFiles.map(f => f.name).join(', ');
        throw new Error(
          `No conversation data found in zip file.\n\n` +
          `Found files: ${foundFiles || 'none'}\n\n` +
          `Required: One of the following files with conversation data:\n` +
          `- conversation.jsonl\n` +
          `- conversations.jsonl\n` +
          `- full_dataset.json\n` +
          `- conversations.json\n\n` +
          `The zip file should contain at least one of these files with your conversation/response data.`
        );
      }

      // Process conversations (same as onLoadResultsLocal)
      console.log('🔧 Processing conversations...');
      const columns = inferColumns(conversations);
      console.log('📋 Detected columns:', columns);

      const detectedMethod = detectMethodFromColumns(columns);
      console.log('🎯 Detected method:', detectedMethod);
      setMethod(detectedMethod);

      setOriginalRows(conversations);
      setAvailableColumns(columns);

      const operational = conversations.map((conv, idx) => ({
        __index: idx,
        question_id: conv.question_id,
        prompt: conv.prompt,

        ...(conv.model && {
          model: conv.model,
          model_response: conv.model_response,
          score: conv.score
        }),

        ...(conv.model_a && {
          model_a: conv.model_a,
          model_b: conv.model_b,
          model_a_response: conv.model_a_response,
          model_b_response: conv.model_b_response,
          score_a: conv.score_a,
          score_b: conv.score_b
        })
      }));

      console.log('🔧 DEBUG: Setting operationalRows:', {
        count: operational.length,
        sampleRow: operational[0],
        method: detectedMethod,
        hasScores: operational[0]?.score || operational[0]?.score_a || operational[0]?.score_b
      });
      setOperationalRows(operational);

      const modelNames = detectedMethod === 'side_by_side' && operational.length > 0
        ? { modelA: operational[0]?.model_a, modelB: operational[0]?.model_b }
        : undefined;

      const { rows: flattened, columns: flattenedColumns } = flattenScores(operational, detectedMethod, modelNames);
      console.log('📊 DEBUG: After flattening:', {
        outputRows: flattened.length,
        sampleOutputRow: flattened[0],
        columns: flattenedColumns,
        scoreColumns: flattenedColumns.filter(c => c.startsWith('score_'))
      });
      setCurrentRows(flattened);

      setShowColumnSelector(false);

      if (properties.length > 0) {
        setPropertiesRows(properties);
        console.log(`✅ Loaded ${properties.length} properties`);
      }

      if (clusters.length > 0) {
        if (Object.keys(metrics || {}).length > 0) {
          const normalizedMetrics = normalizeMetricsColumnNames(metrics);
          console.log('✅ Using pre-computed metrics:', Object.keys(normalizedMetrics));

          if (normalizedMetrics.model_cluster_scores) {
            normalizedMetrics.model_cluster_scores = enrichModelClusterScoresWithMetadata(
              normalizedMetrics.model_cluster_scores,
              clusters
            );
          }

          setResultsMetrics(normalizedMetrics);

          if (normalizedMetrics.model_cluster_scores) {
            const enrichedClusters = enrichClustersWithQualityData(
              clusters,
              normalizedMetrics.model_cluster_scores
            );
            setClusters(ensureExamples(enrichedClusters));
            console.log(`✅ Loaded ${enrichedClusters.length} clusters (enriched with pre-computed metrics)`);
          }
        } else if (conversations.length > 0 && properties.length > 0) {
          console.log('🔢 Computing metrics on-the-fly from conversations + properties + clusters');
          console.log('🔢 Data available:', {
            conversations: conversations.length,
            operational: operational.length,
            properties: properties.length,
            clusters: clusters.length
          });

          try {
            const { computeClusterMetrics } = await import('./lib/clusterMetrics');

            const clusterMetrics = computeClusterMetrics(
              operational,
              properties,
              clusters
            );

            console.log('🔢 Computed metrics for clusters:', clusterMetrics.length);
            console.log('🔢 Sample cluster metrics:', clusterMetrics[0]);

            const enrichedClusters = clusters.map(cluster => {
              const metrics = clusterMetrics.find(m => String(m.cluster_id) === String(cluster.id));
              if (!metrics) {
                console.warn('⚠️ No metrics found for cluster:', cluster.id);
                return cluster;
              }

              console.log(`📊 Enriching cluster ${cluster.label} with:`, {
                quality_delta_by_model: metrics.quality_delta_by_model,
                total_unique_conversations: metrics.total_unique_conversations
              });

              return {
                ...cluster,
                meta: {
                  ...cluster.meta,
                  proportion_overall: metrics.proportion_overall,
                  proportion_by_model: metrics.proportion_by_model,
                  quality_by_model: metrics.quality_by_model,
                  quality_delta_by_model: metrics.quality_delta_by_model,
                  total_unique_conversations: metrics.total_unique_conversations
                }
              };
            });

            setClusters(ensureExamples(enrichedClusters));
            console.log(`✅ Loaded ${enrichedClusters.length} clusters (enriched with computed metrics)`);
            console.log('✅ Sample enriched cluster meta:', enrichedClusters[0]?.meta);
          } catch (error) {
            console.error('❌ Error computing cluster metrics:', error);
            setClusters(ensureExamples(clusters));
            console.log(`⚠️ Loaded ${clusters.length} clusters without metrics due to error`);
          }
        } else {
          setClusters(ensureExamples(clusters));
          console.log(`✅ Loaded ${clusters.length} clusters (no metrics available)`);
        }
      }

      if (clusters.length > 0 && Object.keys(metrics || {}).length > 0) {
        setActiveSection('metrics');
        console.log('📊 Switched to Metrics view');
      } else if (clusters.length > 0) {
        setActiveSection('clusters');
        console.log('📊 Switched to Clusters view');
      } else if (properties.length > 0) {
        setActiveSection('extraction');
        console.log('📊 Switched to Properties view');
      } else {
        setActiveSection('data');
        console.log('📊 Staying on Data view');
      }

      console.log('✅ Results loaded successfully from zip:', {
        conversations: conversations.length,
        properties: properties.length,
        clusters: clusters.length,
        hasMetrics: !!metrics
      });

    } catch (e: any) {
      console.error('❌ Failed to load results from zip:', e);
      setResultsError(String(e?.message || e));
    } finally {
      setIsLoadingResults(false);
      setResultsLoadingMessage('');
      // Reset file input so the same zip can be uploaded again
      if (resultsInputRef.current) {
        resultsInputRef.current.value = '';
      }
    }
  }, [resetUiStateForNewSource]);

  // Removed local results folder loader (unused)

  // Removed server file loader

  // Removed server results loader

  // Client-side pairing: convert tidy rows to side-by-side format
  function pairTidyToSideBySide(rows: Record<string, any>[], mapping: ColumnMapping): Record<string, any>[] {
    const modelColumn = mapping.selectedModels!.column;
    const modelA = mapping.selectedModels!.modelA;
    const modelB = mapping.selectedModels!.modelB;

    // Filter to only rows with modelA or modelB
    const filteredRows = rows.filter(r => {
      const m = String(r[modelColumn] || '');
      return m === modelA || m === modelB;
    });

    // Group by question_id (or prompt if missing)
    const groups = new Map<string, Record<string, any>[]>();
    filteredRows.forEach(row => {
      const qid = row['question_id'] != null && row['question_id'] !== ''
        ? String(row['question_id'])
        : String(row[mapping.promptCol] || '');
      if (!groups.has(qid)) groups.set(qid, []);
      groups.get(qid)!.push(row);
    });

    // Build side-by-side rows: keep only groups with exactly 2 rows (one per model)
    const pairedRows: Record<string, any>[] = [];
    let pairIndex = 0;

    groups.forEach((groupRows, qid) => {
      const rowA = groupRows.find(r => String(r[modelColumn]) === modelA);
      const rowB = groupRows.find(r => String(r[modelColumn]) === modelB);

      if (rowA && rowB) {
        const sbsRow: Record<string, any> = {
          __index: pairIndex++,
          question_id: qid,
          prompt: rowA[mapping.promptCol] || rowB[mapping.promptCol] || '',
          model_a: modelA,
          model_b: modelB,
          model_a_response: rowA[mapping.responseCols[0]] || '',
          model_b_response: rowB[mapping.responseCols[0]] || '',
        };

        // Build score_a and score_b from selected score columns
        if (mapping.scoreCols.length > 0) {
          const toNumber = (v: any): number | undefined => {
            if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
            if (typeof v === 'string' && v.trim() !== '') {
              const n = Number(v);
              return Number.isFinite(n) ? n : undefined;
            }
            return undefined;
          };

          const parseMaybeJsonDict = (v: any): Record<string, any> | null => {
            if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>;
            if (typeof v === 'string') {
              const s = v.trim();
              if (s.startsWith('{') && s.endsWith('}')) {
                try { return JSON.parse(s); } catch (_) { return null; }
              }
            }
            return null;
          };

          const buildScore = (r: Record<string, any>) => {
            const s: Record<string, number> = {};
            for (const col of mapping.scoreCols) {
              const raw = r[col];
              const asDict = parseMaybeJsonDict(raw);
              if (asDict) {
                // Score column contains an object like {accuracy: 0.8}
                for (const [k, v] of Object.entries(asDict)) {
                  const num = toNumber(v);
                  if (num !== undefined) s[k] = num;
                }
              } else {
                // Score column is a scalar value
                const k = col.replace(/^(score_)?/i, '').replace(/_?score$/i, '') || 'value';
                const num = toNumber(raw);
                if (num !== undefined) s[k] = num;
              }
            }
            return Object.keys(s).length > 0 ? s : undefined;
          };

          const scoreA = buildScore(rowA);
          const scoreB = buildScore(rowB);
          if (scoreA) sbsRow.score_a = scoreA;
          if (scoreB) sbsRow.score_b = scoreB;
        }

        pairedRows.push(sbsRow);
      }
    });

    return pairedRows;
  }

  // New function to process data with flexible column mapping
  function processDataWithMapping(rows: Record<string, any>[], mapping: ColumnMapping) {
    setMethod(mapping.method);
    setColumnMapping(mapping);
    setFilterNotice(null);

    // Create operational data using user-specified columns (first build standardized + score dicts)
    const mappedRows = rows.map((row, index) => {
      // Keep processed rows minimal: only core identifiers, models, responses, and score dicts
      const opRow: Record<string, any> = { __index: index };

      // Ensure every operational row has a stable question_id used by backend joins
      // Prefer existing question_id if present; otherwise fallback to row index
      const existingQid = row['question_id'];
      opRow.question_id = existingQid != null && existingQid !== '' ? String(existingQid) : String(index);

      // Map prompt column
      if (mapping.promptCol && row[mapping.promptCol] !== undefined) {
        opRow.prompt = row[mapping.promptCol];
      }

      // Map response columns
      if (mapping.method === 'single_model' && mapping.responseCols[0]) {
        opRow.model_response = row[mapping.responseCols[0]];
      } else if (mapping.method === 'side_by_side') {
        if (mapping.responseCols[0]) opRow.model_a_response = row[mapping.responseCols[0]];
        if (mapping.responseCols[1]) opRow.model_b_response = row[mapping.responseCols[1]];
      }

      // Map model columns (with defaults if not mapped)
      if (mapping.method === 'single_model') {
        if (mapping.modelCols[0]) {
          opRow.model = row[mapping.modelCols[0]];
        } else {
          // Default model name if not mapped
          opRow.model = 'model';
        }
      } else if (mapping.method === 'side_by_side') {
        if (mapping.modelCols[0]) {
          opRow.model_a = row[mapping.modelCols[0]];
        } else {
          // Default model_a name if not mapped
          opRow.model_a = 'model_a';
        }
        if (mapping.modelCols[1]) {
          opRow.model_b = row[mapping.modelCols[1]];
        } else {
          // Default model_b name if not mapped
          opRow.model_b = 'model_b';
        }
      }

      // Build score dictionaries per selected columns (backend contract)
      if (mapping.scoreCols.length > 0) {
        const toNumber = (v: any): number | undefined => {
          if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
          if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
          }
          return undefined;
        };

        const parseMaybeJsonDict = (v: any): Record<string, any> | null => {
          if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>;
          if (typeof v === 'string') {
            const s = v.trim();
            if (s.startsWith('{') && s.endsWith('}')) {
              try { return JSON.parse(s); } catch (_) { return null; }
            }
          }
          return null;
        };

        if (mapping.method === 'single_model') {
          const scoreDict: Record<string, number> = {};
          for (const col of mapping.scoreCols) {
            const raw = row[col];
            const asDict = parseMaybeJsonDict(raw);
            if (asDict) {
              for (const [k, v] of Object.entries(asDict)) {
                const num = toNumber(v);
                if (num !== undefined) scoreDict[k] = num;
              }
            } else {
              const key = col.replace(/^(score_)?/i, '').replace(/_?score$/i, '') || 'value';
              const num = toNumber(raw);
              if (num !== undefined) scoreDict[key] = num;
            }
          }
          if (Object.keys(scoreDict).length > 0) (opRow as any).score = scoreDict;
        } else {
          const scoreADict: Record<string, number> = {};
          const scoreBDict: Record<string, number> = {};
          for (const col of mapping.scoreCols) {
            const raw = row[col];
            const asDict = parseMaybeJsonDict(raw);
            const target = col.toLowerCase().includes('_b') ? scoreBDict
              : col.toLowerCase().includes('_a') ? scoreADict
                : null; // apply to both if null
            if (asDict) {
              for (const [k, v] of Object.entries(asDict)) {
                const num = toNumber(v);
                if (num !== undefined) {
                  if (target === scoreADict) scoreADict[k] = num;
                  else if (target === scoreBDict) scoreBDict[k] = num;
                  else { scoreADict[k] = num; scoreBDict[k] = num; }
                }
              }
            } else {
              const base = col.replace(/^(score_)?/i, '').replace(/_?score$/i, '').replace(/_a$/i, '').replace(/_b$/i, '') || 'value';
              const num = toNumber(raw);
              if (num !== undefined) {
                if (target === scoreADict) scoreADict[base] = num;
                else if (target === scoreBDict) scoreBDict[base] = num;
                else { scoreADict[base] = num; scoreBDict[base] = num; }
              }
            }
          }
          if (Object.keys(scoreADict).length > 0) (opRow as any).score_a = scoreADict;
          if (Object.keys(scoreBDict).length > 0) (opRow as any).score_b = scoreBDict;
        }
      }

      // Do not include any other columns to keep the operational data clean
      return opRow;
    });

    // Filter out rows where any selected score is missing
    let filteredCount = 0;
    const scoreCols = mapping.scoreCols || [];
    const hasScoresSelected = scoreCols.length > 0;
    const isMissing = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && Number.isNaN(v)) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
    const rowsAfterFilter = !hasScoresSelected ? mappedRows : mappedRows.filter((_, idx) => {
      const original = rows[idx];
      const missingAny = scoreCols.some(col => isMissing(original[col]));
      if (missingAny) filteredCount += 1;
      return !missingAny;
    });

    if (hasScoresSelected && filteredCount > 0) {
      setFilterNotice(`Filtered out ${filteredCount} row(s) due to missing values in selected score columns: ${scoreCols.join(', ')}`);
    }

    // Keep operational rows with consolidated score objects (backend format)
    console.log('🔧 DEBUG: Setting operationalRows:', {
      count: rowsAfterFilter.length,
      sampleRow: rowsAfterFilter[0],
      method: mapping.method,
      scoreObject: rowsAfterFilter[0]?.score || rowsAfterFilter[0]?.score_a,
      scoreKeys: rowsAfterFilter[0]?.score ? Object.keys(rowsAfterFilter[0].score) :
        rowsAfterFilter[0]?.score_a ? Object.keys(rowsAfterFilter[0].score_a) : [],
      hasScores: !!(rowsAfterFilter[0]?.score || rowsAfterFilter[0]?.score_a || rowsAfterFilter[0]?.score_b)
    });
    setOperationalRows(rowsAfterFilter);

    // Create display rows with flattened scores for UI table
    console.log('📊 DEBUG: Before flattening:', {
      inputRows: rowsAfterFilter.length,
      sampleInputRow: rowsAfterFilter[0],
      method: mapping.method
    });
    // Extract model names for side-by-side score labeling
    const modelNames = mapping.method === 'side_by_side' && rowsAfterFilter.length > 0
      ? { modelA: rowsAfterFilter[0]?.model_a, modelB: rowsAfterFilter[0]?.model_b }
      : undefined;

    const { rows: flattenedRows, columns: flattenedColumns } = flattenScores(rowsAfterFilter, mapping.method, modelNames);
    console.log('📊 DEBUG: After flattening:', {
      outputRows: flattenedRows.length,
      sampleOutputRow: flattenedRows[0],
      columns: flattenedColumns,
      scoreColumns: flattenedColumns.filter(c => c.startsWith('score_'))
    });
    setCurrentRows(flattenedRows);

    // If user chose two models in single_model mapping, promote to side_by_side by calling backend later
    setColumnMapping(prev => ({ ...mapping }));
  }

  // Handle column mapping changes from the selector
  const handleMappingChange = useCallback((mapping: ColumnMapping) => {
    if (mappingValid && originalRows.length > 0) {
      // If user selected two models under side_by_side (tidy path), pair client-side
      if (mapping.method === 'side_by_side' && mapping.selectedModels && mapping.selectedModels.modelA && mapping.selectedModels.modelB && mapping.selectedModels.modelA !== mapping.selectedModels.modelB) {
        const pairedRows = pairTidyToSideBySide(originalRows, mapping);

        console.log('[handleMappingChange] Paired tidy to side-by-side:', {
          pairs: pairedRows.length,
          sample: pairedRows[0],
          modelA: mapping.selectedModels.modelA,
          modelB: mapping.selectedModels.modelB
        });

        if (pairedRows.length === 0) {
          setResultsError(`No matching pairs found for models "${mapping.selectedModels.modelA}" and "${mapping.selectedModels.modelB}". Ensure both models answered the same prompts.`);
          return;
        }

        // Set method and operational rows to the paired side-by-side data
        setMethod('side_by_side');
        setColumnMapping(mapping);
        setOperationalRows(pairedRows);

        // Flatten for display with actual model names
        const { rows: flattened } = flattenScores(pairedRows, 'side_by_side', {
          modelA: mapping.selectedModels.modelA,
          modelB: mapping.selectedModels.modelB
        });
        setCurrentRows(flattened);

        setShowColumnSelector(false);
        setSidebarExpanded(false);
      } else {
        // Standard processing for single_model or legacy side_by_side
        processDataWithMapping(originalRows, mapping);
        setShowColumnSelector(false);
        setSidebarExpanded(false);
      }
    }
  }, [mappingValid, originalRows]);

  // Handle validation changes from the selector
  const handleValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setMappingValid(isValid);
    setMappingErrors(errors);
  }, []);

  const onView = useCallback((row: Record<string, any>, preserveEvidence = false) => {
    console.log('[App] onView called with preserveEvidence:', preserveEvidence);

    // Look up the operational row (which has consolidated score objects)
    const idx = row.__index;
    const operationalRow = idx != null
      ? operationalRows.find(r => Number(r?.__index) === Number(idx))
      : null;

    // Use operational row for scores, fallback to current row
    const rowWithScores = operationalRow || row;

    if (method === "single_model") {
      const messages = ensureOpenAIFormat(String(row?.["prompt"] ?? ""), row?.["model_response"]);
      setSelectedTrace({ type: "single", messages });
    } else if (method === "side_by_side") {
      const prompt = String(row?.["prompt"] ?? "");
      const messagesA = ensureOpenAIFormat(prompt, row?.["model_a_response"]);
      const messagesB = ensureOpenAIFormat(prompt, row?.["model_b_response"]);
      setSelectedTrace({
        type: "sbs",
        messagesA,
        messagesB,
        modelA: String(row?.["model_a"] ?? "Model A"),
        modelB: String(row?.["model_b"] ?? "Model B"),
      });
    }
    setSelectedRow(rowWithScores);
    setDrawerOpen(true);
    if (!preserveEvidence) {
      console.log('[App] onView - Clearing evidence (preserveEvidence=false)');
      setSelectedEvidence(null);
      setEvidenceTargetModel(undefined);
      setSelectedProperty(null); // Clear property context when viewing from main table
    } else {
      console.log('[App] onView - Preserving evidence (preserveEvidence=true)');
    }
  }, [method, operationalRows, tutorial]);

  const responseKeys = useMemo(() =>
    method === "single_model"
      ? ["model_response"]
      : method === "side_by_side"
        ? ["model_a_response"]  // Only one column needed - View shows both traces side-by-side
        : [],
    [method]
  );

  // Keep clusters view mounted after first visit to avoid re-mount plot cost
  React.useEffect(() => {
    if (activeSection === 'clusters' && !hasViewedClusters) setHasViewedClusters(true);
  }, [activeSection, hasViewedClusters]);

  // Close cluster sidecard when navigating away from clusters view
  React.useEffect(() => {
    if (activeSection !== 'clusters') {
      setClusterSidecardOpen(false);
      setSelectedCluster(null);
    }
  }, [activeSection]);

  // Get allowed columns from current (display) data with proper ordering
  const allowedColumns = useMemo(() => {
    if (currentRows.length === 0) return [];
    const allColumns = Object.keys(currentRows[0]);

    // For side-by-side, hide model names and model_b_response (we only show one View button via model_a_response)
    const hiddenSbsColumns = method === 'side_by_side'
      ? ['model_a', 'model_b', 'model_b_response']
      : [];

    const visibleColumns = allColumns.filter(c => !hiddenSbsColumns.includes(c));

    // Order: index → prompt → response columns → remaining
    const indexCol = visibleColumns.filter((c) => c === '__index');
    const promptFirst = visibleColumns.filter((c) => c === 'prompt');
    const resp = visibleColumns.filter((c) => responseKeys.includes(c));
    const remaining = visibleColumns.filter((c) => c !== '__index' && c !== 'prompt' && !responseKeys.includes(c));

    const result = [...indexCol, ...promptFirst, ...resp, ...remaining];
    console.log('🔗 DEBUG allowedColumns (from currentRows - FIXED):', {
      currentRowsCount: currentRows.length,
      allColumns,
      hiddenSbsColumns,
      visibleColumns,
      result,
      scoreColumns: allColumns.filter(c => c.startsWith('score_')),
      sampleCurrentRow: currentRows[0]
    });
    return result;
  }, [currentRows, responseKeys, method]);

  // -------- Data Operations Chain ---------
  const [operationChain, setOperationChain] = useState<DataOperation[]>([]);
  const [pendingColumn, setPendingColumn] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [pendingNegated, setPendingNegated] = useState<boolean>(false);
  const [dataSearchQuery, setDataSearchQuery] = useState<string>('');

  // Legacy filter interface for compatibility
  type Filter = { column: string; values: string[]; negated: boolean; operator?: 'AND' | 'OR' };
  const filters: Filter[] = operationChain
    .filter(op => op.type === 'filter')
    .map(op => op as any);

  const categoricalColumns = useMemo(() => {
    if (operationalRows.length === 0) return [] as string[];
    const cols = new Set<string>();
    for (const c of allowedColumns) {
      // Skip index column - it's not categorical
      if (c === '__index') continue;
      const uniq = new Set(operationalRows.slice(0, 500).map(r => r?.[c])).size;
      if (uniq > 0 && uniq <= 50) cols.add(c);
    }
    return Array.from(cols);
  }, [operationalRows, allowedColumns]);

  const numericCols = useMemo(() => {
    if (currentRows.length === 0) return [] as string[];
    // Consider a column numeric if the first few non-null values can be parsed as finite numbers
    const sample = currentRows.slice(0, 25);
    const isNumericColumn = (col: string) => {
      let seen = 0;
      let numeric = 0;
      for (const r of sample) {
        const v = (r as any)[col];
        if (v === null || v === undefined || v === '') continue;
        seen += 1;
        const n = Number(v);
        if (Number.isFinite(n)) numeric += 1;
        if (seen >= 5) break; // small check window
      }
      return seen > 0 && numeric === seen;
    };
    return allowedColumns.filter(c => c === '__index' || isNumericColumn(c));
  }, [currentRows, allowedColumns]);

  const uniqueValuesFor = useMemo(() => {
    const cache = new Map<string, string[]>();
    return (col: string) => {
      if (cache.has(col)) {
        return cache.get(col)!;
      }
      const s = new Set<string>();
      currentRows.forEach(r => { const v = r?.[col]; if (v !== undefined && v !== null) s.add(String(v)); });
      const result = Array.from(s).sort();
      cache.set(col, result);
      return result;
    };
  }, [currentRows]);

  // Apply the entire operation chain to operational data
  const applyOperationChain = useCallback(async (operations: DataOperation[]) => {
    console.log('🔄 Applying operation chain:', operations);

    // Start from operational data (with score dicts)
    let opData = [...operationalRows];

    // Apply custom operations on operational data (backend needs score dicts)
    for (const operation of operations) {
      if (operation.type === 'custom') {
        const customOp = operation as any;
        try {
          const res = await dfCustom({
            rows: opData,
            code: customOp.code,
            sample_size: isDemoMode ? demoSampleSize : undefined
          });
          if (res.error) {
            console.error('Custom operation failed:', res.error);
          } else {
            opData = res.rows || opData;
            console.log(`🐍 Custom code: ${opData.length} rows`);
          }
        } catch (e) {
          console.error('Custom operation error:', e);
        }
      }
    }

    // Always flatten for UI display
    const modelNames = method === 'side_by_side' && opData.length > 0
      ? { modelA: opData[0]?.model_a, modelB: opData[0]?.model_b }
      : undefined;
    const { rows: flattenedRows } = flattenScores(opData, method, modelNames);
    let displayData = flattenedRows;

    // Apply filter operations on flattened data (so score_* columns can be filtered)
    const filterOps = operations.filter(op => op.type === 'filter') as any[];
    if (filterOps.length > 0) {
      displayData = displayData.filter(row => {
        // For each row, evaluate all filters according to their operators
        let combinedResult = false;

        filterOps.forEach((filterOp, index) => {
          const rowValue = String(row[filterOp.column] ?? '');
          const matchesValues = filterOp.values.includes(rowValue);
          const filterResult = filterOp.negated ? !matchesValues : matchesValues;

          if (index === 0) {
            // First filter: no operator, just use the result
            combinedResult = filterResult;
          } else {
            // Subsequent filters: apply operator
            if (filterOp.operator === 'OR') {
              combinedResult = combinedResult || filterResult;
            } else {
              // Default to AND
              combinedResult = combinedResult && filterResult;
            }
          }
        });

        return combinedResult;
      });
      console.log(`🔍 Applied ${filterOps.length} filter(s): ${displayData.length} rows`);
    }

    // Apply sort operations on flattened data (so score_* columns sort correctly)
    const sortOp = operations.find(op => op.type === 'sort') as any | undefined;
    if (sortOp) {
      displayData = [...displayData].sort((a, b) => {
        let aVal = a[sortOp.column];
        let bVal = b[sortOp.column];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortOp.direction === 'asc' ? 1 : -1;
        if (bVal == null) return sortOp.direction === 'asc' ? -1 : 1;

        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          const diff = aNum - bNum;
          return sortOp.direction === 'asc' ? diff : -diff;
        } else {
          const comp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
          return sortOp.direction === 'asc' ? comp : -comp;
        }
      });
      console.log(`🔄 Sort ${sortOp.column} ${sortOp.direction}: ${displayData.length} rows`);
    }

    console.log(`Final result (flattened): ${displayData.length} rows`);
    setCurrentRows(displayData);
  }, [operationalRows, method, isDemoMode, demoSampleSize]);

  // Legacy wrapper for backward compatibility
  const applyFilters = useCallback(async (newFilters: Filter[]) => {
    const filterOps = newFilters.map(f => createFilterOperation(f.column, f.values, f.negated, f.operator));
    const nonFilterOps = operationChain.filter(op => op.type !== 'filter');
    const newChain = [...filterOps, ...nonFilterOps];
    setOperationChain(newChain);
    await applyOperationChain(newChain);
  }, [operationChain, applyOperationChain]);

  const resetAll = useCallback(() => {
    const modelNames = method === 'side_by_side' && operationalRows.length > 0
      ? { modelA: operationalRows[0]?.model_a, modelB: operationalRows[0]?.model_b }
      : undefined;
    const { rows: flattened } = flattenScores(operationalRows, method, modelNames);
    setCurrentRows(flattened);
    setOperationChain([]);
    setGroupBy(null);
    setGroupPreview([]);
    setExpandedGroup(null);
    setCustomCode("");
    setCustomError(null);
    setSortColumn(null);
    setSortDirection(null);
  }, [operationalRows, method]);

  // -------- GroupBy State ---------
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [groupPreview, setGroupPreview] = useState<{ value: any; count: number; means: Record<string, number> }[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<any | null>(null); // reserved for grouped row details
  const [groupPage, setGroupPage] = useState<number>(1); // reserved for grouped row pagination
  const [groupRows, setGroupRows] = useState<Record<string, any>[]>([]); // reserved for grouped row details
  const [groupTotal, setGroupTotal] = useState<number>(0); // reserved for grouped row details
  const [groupPagination, setGroupPagination] = useState<Map<string, number>>(new Map());

  // -------- Sorting State ---------
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Sort function
  const handleSort = useCallback((column: string) => {
    let newDirection: 'asc' | 'desc' | null = 'asc';

    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
      }
    }

    setSortColumn(newDirection ? column : null);
    setSortDirection(newDirection);

    // Update operation chain
    const nonSortOps = operationChain.filter(op => op.type !== 'sort');
    const newChain = newDirection
      ? [...nonSortOps, createSortOperation(column, newDirection)]
      : nonSortOps;

    setOperationChain(newChain);
    void applyOperationChain(newChain);
  }, [sortColumn, sortDirection, operationChain, applyOperationChain]);

  // Auto-select first row for extraction when data changes
  React.useEffect(() => {
    if (currentRows.length > 0 && !selectedRowForExtraction) {
      setSelectedRowForExtraction(currentRows[0]);
    }
  }, [currentRows, selectedRowForExtraction]);

  // Apply sorting + search to currentRows with performance optimization
  const sortedRows = useMemo(() => {
    console.log('📊 DEBUG sortedRows generation:', {
      currentRowsCount: currentRows.length,
      sampleCurrentRow: currentRows[0],
      currentRowKeys: currentRows[0] ? Object.keys(currentRows[0]) : [],
      scoreColumns: currentRows[0] ? Object.keys(currentRows[0]).filter(k => k.startsWith('score_')) : []
    });

    // Apply search filter first
    let filteredRows = currentRows;
    if (dataSearchQuery.trim()) {
      const query = dataSearchQuery.toLowerCase().trim();
      filteredRows = currentRows.filter(row => {
        // Search across all text columns
        return allowedColumns.some(col => {
          const value = row[col];
          return value != null && String(value).toLowerCase().includes(query);
        });
      });
    }

    if (!sortColumn || !sortDirection) {
      console.log('📊 DEBUG sortedRows result (no sorting):', {
        resultCount: filteredRows.length,
        sampleResult: filteredRows[0]
      });
      return filteredRows;
    }

    // Use faster array copy and optimize comparison
    const result = filteredRows.length > 5000 ? filteredRows : filteredRows.slice();

    // Pre-determine if column is numeric for better performance
    const isNumericColumn = filteredRows.length > 0 &&
      filteredRows.slice(0, 10).every(row => {
        const val = row[sortColumn];
        return val == null || !isNaN(Number(val));
      });

    // For very large datasets, use localeCompare only for short strings to reduce CPU
    result.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      if (isNumericColumn) {
        // Numeric comparison
        aVal = Number(aVal);
        bVal = Number(bVal);
        const diff = aVal - bVal;
        return sortDirection === 'asc' ? diff : -diff;
      } else {
        // String comparison with cached lowercase
        const aStr = String(aVal);
        const bStr = String(bVal);
        // Avoid lowercasing very long strings
        const aCmp = aStr.length < 256 ? aStr.toLowerCase() : aStr;
        const bCmp = bStr.length < 256 ? bStr.toLowerCase() : bStr;
        const comp = aCmp < bCmp ? -1 : aCmp > bCmp ? 1 : 0;
        return sortDirection === 'asc' ? comp : -comp;
      }
    });

    return result;
  }, [currentRows, sortColumn, sortDirection, dataSearchQuery, allowedColumns]);

  // Memoize expensive data overview calculations using sorted data
  const dataOverview = useMemo(() => {
    if (sortedRows.length === 0) return null;
    const uniquePrompts = new Set(sortedRows.map(r => r?.prompt)).size;
    let uniqueModels = 0;
    if (method === 'single_model') {
      uniqueModels = new Set(sortedRows.map(r => r?.model)).size;
    } else if (method === 'side_by_side') {
      uniqueModels = new Set([
        ...sortedRows.map(r => r?.model_a || ''),
        ...sortedRows.map(r => r?.model_b || '')
      ]).size;
    }
    return {
      rowCount: sortedRows.length.toLocaleString(),
      uniquePrompts: uniquePrompts.toLocaleString(),
      uniqueModels: uniqueModels.toLocaleString(),
    };
  }, [sortedRows, method]);

  // Truncated Cell component for grouped view
  const TruncatedCell = React.memo(function TruncatedCell({ text }: { text: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const MAX_LEN = 200;
    if (!expanded && text.length > MAX_LEN) {
      return (
        <span>
          {text.slice(0, MAX_LEN)}…{' '}
          <Button size="small" variant="text" onClick={() => setExpanded(true)}>Expand</Button>
        </span>
      );
    }
    if (expanded && text.length > MAX_LEN) {
      return (
        <span>
          {text}{' '}
          <Button size="small" variant="text" onClick={() => setExpanded(false)}>Collapse</Button>
        </span>
      );
    }
    return <span>{text}</span>;
  });

  // -------- Custom Code ---------
  const [customCode, setCustomCode] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);

  const handleCustomCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomCode(e.target.value);
  }, []);

  const runCustom = useCallback(async () => {
    if (!customCode.trim()) return;

    try {
      // Add custom operation to chain
      const customOp = createCustomCodeOperation(customCode);
      const newChain = [...operationChain, customOp];
      setOperationChain(newChain);
      setCustomError(null);
      await applyOperationChain(newChain);
      setCustomCode(""); // Clear after successful application
    } catch (e: any) {
      console.error('runCustom error:', e);
      setCustomError(String(e?.message || e));
    }
  }, [customCode, operationChain, applyOperationChain]);

  // Operation management callbacks
  const removeOperation = useCallback((operationId: string) => {
    const newChain = operationChain.filter(op => op.id !== operationId);
    setOperationChain(newChain);

    // Update UI state for removed operations
    const removedOp = operationChain.find(op => op.id === operationId);
    if (removedOp?.type === 'sort') {
      setSortColumn(null);
      setSortDirection(null);
    }

    void applyOperationChain(newChain);
  }, [operationChain, applyOperationChain]);

  // Legacy filter removal for backward compatibility
  const removeFilter = useCallback((index: number) => {
    const filterOps = operationChain.filter(op => op.type === 'filter');
    if (index < filterOps.length) {
      removeOperation(filterOps[index].id);
    }
  }, [operationChain, removeOperation]);

  const refreshGroupPreview = useCallback(async (by: string) => {
    console.log('🟡 refreshGroupPreview called with:', by);
    console.log('🟡 current rows length:', currentRows.length, 'numericCols:', numericCols);

    // Local-first groupby (like filters)
    const grouped = new Map<any, any[]>();
    currentRows.forEach(row => {
      const key = row[by];
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const localGroups = Array.from(grouped.entries()).map(([value, rows]) => {
      const count = rows.length;
      const means: Record<string, number> = {};
      numericCols.forEach(col => {
        const nums = rows.map(r => Number(r[col])).filter(n => !isNaN(n));
        if (nums.length > 0) {
          means[col] = nums.reduce((sum, n) => sum + n, 0) / nums.length;
        }
      });
      return { value, count, means };
    });

    console.log('🟡 Local groupby result:', localGroups);
    setGroupPreview(localGroups);

    // Optional backend validation (fire-and-forget). We intentionally do NOT overwrite the local
    // preview to avoid flicker when backend lacks flattened numeric columns. Keep for logging only.
    try {
      const canValidate = operationalRows.length > 0 && Object.prototype.hasOwnProperty.call(operationalRows[0] || {}, by);
      if (canValidate) {
        void dfGroupPreview({ rows: operationalRows, by }).then((res) => {
          console.log('🟡 dfGroupPreview (ignored for UI) response:', res);
        }).catch((e) => {
          console.log('🟡 Backend validation failed (ignored):', e);
        });
      }
    } catch (_) {
      // no-op
    }
  }, [currentRows, operationalRows, numericCols]);

  // Memoized table content to keep hook order stable
  const tableContent = useMemo(() => {
    if (activeSection !== 'data') return null;
    if (operationalRows.length === 0) return null;
    if (groupBy && groupPreview.length > 0) {
      const groupedRowsMap = new Map<any, any[]>();
      sortedRows.forEach((row) => {
        const key = row[groupBy];
        if (!groupedRowsMap.has(key)) groupedRowsMap.set(key, []);
        groupedRowsMap.get(key)!.push(row);
      });
      return (
        <>
          {/* Benchmark Metrics Table (same style as Metrics tab) */}
          <DataTabBenchmarkTable
            operationalRows={operationalRows}
            method={method}
            propertiesRows={propertiesRows}
            modelScores={resultsMetrics?.model_scores}
          />

          {/* Keep FilterBar visible in grouped mode */}
          <Box sx={{ mt: 2 }}>
            <FilterBar
              searchValue={dataSearchQuery}
              onSearchChange={setDataSearchQuery}
              searchPlaceholder="Search data..."
              categoricalColumns={categoricalColumns}
              pendingColumn={pendingColumn}
              pendingValues={pendingValues}
              pendingNegated={pendingNegated}
              onPendingColumnChange={(column) => {
                setPendingColumn(column);
                setPendingValues([]);
                setPendingNegated(false);
              }}
              onPendingValuesChange={setPendingValues}
              onPendingNegatedChange={setPendingNegated}
              onAddFilter={() => {
                if (!pendingColumn || pendingValues.length === 0) return;
                const operator: Filter['operator'] = filters.length > 0 ? 'AND' : undefined;
                const next: Filter[] = [...filters, { column: pendingColumn, values: pendingValues, negated: pendingNegated, operator }];
                setPendingColumn(null);
                setPendingValues([]);
                setPendingNegated(false);
                void applyFilters(next);
              }}
              filters={filters}
              onRemoveFilter={removeFilter}
              onChangeFilterOperator={(index, operator) => {
                const next: Filter[] = filters.map((f, i) => i === index ? { ...f, operator } : f);
                void applyFilters(next);
              }}
              uniqueValuesFor={uniqueValuesFor}
              resultCount={sortedRows.length}
              resultLabel="rows"
              showGroupBy={true}
              groupByOptions={allowedColumns}
              groupByValue={groupBy}
              onGroupByChange={(v) => {
                console.log('🔵 GroupBy onChange triggered with value:', v);
                setGroupBy(v);
                setExpandedGroup(null);
                setGroupRows([]);
                if (v) {
                  console.log('🔵 Calling refreshGroupPreview with:', v);
                  refreshGroupPreview(v);
                } else {
                  console.log('🔵 Clearing group preview');
                  setGroupPreview([]);
                }
              }}
            />
          </Box>
          <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 0.5, overflow: 'auto', backgroundColor: '#FFFFFF' }}>
            <Box sx={{ backgroundColor: '#F3F4F6', p: 2, borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: `auto 2fr 1fr 1fr repeat(${Math.max(allowedColumns.length - 3, 0)}, 1fr)`, gap: 2, alignItems: 'center', minWidth: 960 }}>
                <Box sx={{ width: 24 }} />
                {allowedColumns.map((col, index) => (
                  <Box key={col} sx={{ gridColumn: index === 0 ? 'span 1' : undefined, display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort(col)}>
                    <Typography variant="subtitle2" sx={{ color: '#374151', fontWeight: 700, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {col === '__index' ? 'INDEX' :
                        col === 'prompt' ? 'PROMPT' :
                          col === 'model' ? 'MODEL' :
                            col === 'model_response' ? 'RESPONSE' :
                              col === 'model_responses' ? 'MODEL RESPONSES' :
                                col === 'model_a' ? 'MODEL A' :
                                  col === 'model_b' ? 'MODEL B' :
                                    col === 'model_a_response' ? 'RESPONSE' :
                                      col === 'model_b_response' ? 'RESPONSE' :
                                        col.toUpperCase()}
                    </Typography>
                    {sortColumn === col && sortDirection === 'asc' && <ArrowUpwardIcon sx={{ fontSize: 12, color: '#374151' }} />}
                    {sortColumn === col && sortDirection === 'desc' && <ArrowDownwardIcon sx={{ fontSize: 12, color: '#374151' }} />}
                  </Box>
                ))}
              </Box>
            </Box>

            {Array.from(groupedRowsMap.entries()).map(([groupValue, rows]) => {
              const groupKey = String(groupValue);
              const currentPage = groupPagination.get(groupKey) || 1;
              const pageSize = 10;
              const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
              const totalPages = Math.ceil(rows.length / pageSize);
              const handlePageChange = (page: number) => {
                setGroupPagination(prev => new Map(prev).set(groupKey, page));
              };
              return (
                <Accordion key={groupKey} sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: 'none' }}>
                  <AccordionSummary expandIcon={null} sx={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', minHeight: 48, '&.Mui-expanded': { minHeight: 48 }, '& .MuiAccordionSummary-content': { margin: '12px 0' }, cursor: 'pointer', '&:hover': { backgroundColor: '#F3F4F6' } }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: `auto 2fr 1fr 1fr repeat(${Math.max(allowedColumns.length - 3, 0)}, 1fr)`, gap: 2, alignItems: 'center', width: '100%', minWidth: 960 }}>
                      <ExpandMoreIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                      {/* Group label spans first three columns */}
                      <Box sx={{ gridColumn: '2 / span 3', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {String(groupValue).length > 50 ? String(groupValue).slice(0, 50) + '...' : String(groupValue)}
                        </Typography>
                        <Typography variant="body2" sx={{ backgroundColor: '#E0E7FF', color: '#3730A3', px: 1.5, py: 0.25, borderRadius: 9999, fontSize: 11, fontWeight: 500, textAlign: 'center', minWidth: 20 }}>
                          {rows.length}
                        </Typography>
                      </Box>
                      {allowedColumns.slice(3).map((col) => {
                        if (responseKeys.includes(col)) return <Box key={col} />;
                        const groupStats = groupPreview.find(g => g.value === groupValue);
                        const mean = groupStats?.means[col];
                        if (typeof mean === 'number') {
                          return (
                            <Typography key={col} variant="body2" sx={{ color: '#6B7280', fontStyle: 'italic', fontSize: 13 }}>
                              avg: {mean.toFixed(decimalPrecision)}
                            </Typography>
                          );
                        }
                        return <Box key={col} />;
                      })}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <Box>
                      {paginatedRows.map((row: any, idx: number) => (
                        <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: `auto 2fr 1fr 1fr repeat(${Math.max(allowedColumns.length - 3, 0)}, 1fr)`, gap: 2, alignItems: 'center', p: 2, borderBottom: idx < paginatedRows.length - 1 ? '1px solid #E5E7EB' : 'none', minWidth: 960 }}>
                          <Box sx={{ width: 24 }} />
                          {/* First three columns render as-is */}
                          {allowedColumns.slice(0, 3).map(col => (
                            <Box key={col}>
                              {responseKeys.includes(col) ? (
                                <Button size="small" variant="text" startIcon={<VisibilityOutlinedIcon />} onClick={() => onView(row)} sx={{ fontWeight: 600, color: retroColors.blue }}>
                                  View
                                </Button>
                              ) : (
                                (() => {
                                  const value = row[col];
                                  const isNumeric = col === '__index' || (value !== null && value !== undefined && !isNaN(Number(value)) && value !== '');
                                  const isPrompt = col === 'prompt';
                                  return (
                                    <Typography variant="body2" sx={{ maxWidth: 200, textAlign: isNumeric ? 'center' : 'left' }}>
                                      {isPrompt ? (<FormattedCell text={String(value ?? '')} isPrompt={true} />) : (<TruncatedCell text={String(value ?? '')} />)}
                                    </Typography>
                                  );
                                })()
                              )}
                            </Box>
                          ))}
                          {/* Remaining columns */}
                          {allowedColumns.slice(3).map(col => (
                            <Box key={col}>
                              {responseKeys.includes(col) ? (
                                <Button size="small" variant="text" startIcon={<VisibilityOutlinedIcon />} onClick={() => onView(row)} sx={{ fontWeight: 600, color: retroColors.blue }}>
                                  View
                                </Button>
                              ) : (
                                (() => {
                                  const value = row[col];
                                  const isNumeric = col === '__index' || (value !== null && value !== undefined && !isNaN(Number(value)) && value !== '');
                                  const isPrompt = col === 'prompt';
                                  return (
                                    <Typography variant="body2" sx={{ maxWidth: 200, textAlign: isNumeric ? 'center' : 'left' }}>
                                      {isPrompt ? (<FormattedCell text={String(value ?? '')} isPrompt={true} />) : (<TruncatedCell text={String(value ?? '')} />)}
                                    </Typography>
                                  );
                                })()
                              )}
                            </Box>
                          ))}
                        </Box>
                      ))}
                      {totalPages > 1 && (
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: '1px solid #E5E7EB' }}>
                          <Pagination count={totalPages} page={currentPage} onChange={(_, page) => handlePageChange(page)} size="small" />
                        </Box>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </>
      );
    }

    // Normal flat table view when no groupBy
    return (
      <>
        {/* Benchmark Metrics Table/Chart with toggle */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Quality Metrics
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: benchmarkViewMode === 'table' ? 'text.primary' : 'text.secondary' }}>
                Table
              </Typography>
              <Switch
                checked={benchmarkViewMode === 'graph'}
                onChange={(e) => setBenchmarkViewMode(e.target.checked ? 'graph' : 'table')}
                size="small"
              />
              <Typography variant="body2" sx={{ color: benchmarkViewMode === 'graph' ? 'text.primary' : 'text.secondary' }}>
                Graph
              </Typography>
            </Box>
          </Box>
          <DataTabBenchmarkTable
            operationalRows={operationalRows}
            method={method}
            propertiesRows={propertiesRows}
            modelScores={resultsMetrics?.model_scores}
            viewMode={benchmarkViewMode}
            filters={{
              selectedModels: [],
              selectedMetrics: [],
              selectedGroups: [],
              selectedBehaviorTypes: [],
              qualityMetric: '', // Not needed for grouped chart
              sortBy: 'proportion_delta_desc',
              topN: 5,
              significanceOnly: false,
              showCI: false,
            }}
            onQualityMetricsChange={(metrics) => {
              setAvailableQualityMetrics(metrics);
            }}
          />
        </Box>

        <Box sx={{ mt: 2 }}>
          <FilterBar
            searchValue={dataSearchQuery}
            onSearchChange={setDataSearchQuery}
            searchPlaceholder="Search data..."
            categoricalColumns={categoricalColumns}
            pendingColumn={pendingColumn}
            pendingValues={pendingValues}
            pendingNegated={pendingNegated}
            onPendingColumnChange={(column) => {
              setPendingColumn(column);
              setPendingValues([]);
              setPendingNegated(false);
            }}
            onPendingValuesChange={setPendingValues}
            onPendingNegatedChange={setPendingNegated}
            onAddFilter={() => {
              if (!pendingColumn || pendingValues.length === 0) return;
              const operator: Filter['operator'] = filters.length > 0 ? 'AND' : undefined;
              const next: Filter[] = [...filters, { column: pendingColumn, values: pendingValues, negated: pendingNegated, operator }];
              setPendingColumn(null);
              setPendingValues([]);
              setPendingNegated(false);
              void applyFilters(next);
            }}
            filters={filters}
            onRemoveFilter={removeFilter}
            onChangeFilterOperator={(index, operator) => {
              const next: Filter[] = filters.map((f, i) => i === index ? { ...f, operator } : f);
              void applyFilters(next);
            }}
            uniqueValuesFor={uniqueValuesFor}
            resultCount={sortedRows.length}
            resultLabel="rows"
            showGroupBy={true}
            groupByOptions={allowedColumns}
            groupByValue={groupBy}
            onGroupByChange={(v) => {
              console.log('🔵 GroupBy onChange triggered with value:', v);
              setGroupBy(v);
              setExpandedGroup(null);
              setGroupRows([]);
              if (v) {
                console.log('🔵 Calling refreshGroupPreview with:', v);
                refreshGroupPreview(v);
              } else {
                console.log('🔵 Clearing group preview');
                setGroupPreview([]);
              }
            }}
          />
        </Box>
        <DataTable
          rows={sortedRows}
          columns={allowedColumns}
          responseKeys={responseKeys}
          onView={onView}
          allowedColumns={allowedColumns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          decimalPrecision={decimalPrecision}
        />
      </>
    );
  }, [activeSection, operationalRows, groupBy, groupPreview, sortedRows, allowedColumns, responseKeys, onView, groupPagination, sortColumn, sortDirection, handleSort, dataSearchQuery, categoricalColumns, pendingColumn, pendingValues, pendingNegated, filters, removeFilter, uniqueValuesFor, refreshGroupPreview, customCode, handleCustomCodeChange, runCustom, resetAll, customError]);

  // Memoized properties content
  const propertiesContent = useMemo(() => {
    if (activeSection !== 'extraction') return null;
    if (propertiesRows.length === 0) {
      return (
        <Box sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 0.5, background: '#FFFFFF' }}>
          <Typography variant="body1" color="text.secondary">
            No properties available yet. Run "Extract on selected" or "Run on all traces" from the sidebar.
          </Typography>
        </Box>
      );
    }
    return (
      <PropertiesTab
        rows={propertiesRows}
        originalData={originalRows}
        onOpenProperty={(prop) => {
          console.log('[App] onOpenProperty - Clicked property:', {
            fullProperty: prop,
            question_id: (prop as any).question_id,
            question_id_type: typeof (prop as any).question_id,
            model: (prop as any).model,
            model_type: typeof (prop as any).model,
            __index: (prop as any).__index,
            row_index: (prop as any).row_index,
            allKeys: Object.keys(prop)
          });

          // Use operationalRows (with consolidated score objects) instead of currentRows (flattened)
          // Prefer direct index if present
          const idx = (prop as any).__index ?? (prop as any).row_index;
          let row: any | null = null;
          if (idx != null) {
            console.log('[App] onOpenProperty - Searching by index:', idx);
            row = operationalRows.find(r => Number(r?.__index) === Number(idx)) || null;
            if (row) {
              console.log('[App] onOpenProperty - Found by index!');
            } else {
              console.log('[App] onOpenProperty - No match found by index');
            }
          }
          if (!row) {
            // Fallback: match on question_id and model
            const qid = (prop as any).question_id;
            const modelName = String((prop as any).model || '');

            console.log('[App] onOpenProperty - Searching by question_id + model:', { qid, qid_type: typeof qid, modelName, method });
            console.log('[App] onOpenProperty - Sample operationalRows[0]:', {
              question_id: operationalRows[0]?.question_id,
              question_id_type: typeof operationalRows[0]?.question_id,
              model: operationalRows[0]?.model,
              model_type: typeof operationalRows[0]?.model,
              __index: operationalRows[0]?.__index
            });
            console.log('[App] onOpenProperty - Total operationalRows:', operationalRows.length);

            row = operationalRows.find(r => {
              const rq = r?.question_id;
              const matches = method === 'single_model'
                ? rq === qid && String(r?.model || '') === modelName
                : method === 'side_by_side'
                  ? rq === qid && (String(r?.model_a || '') === modelName || String(r?.model_b || '') === modelName)
                  : false;

              if (matches) {
                console.log('[App] Found match!', { rq, qid, model: r?.model || r?.model_a });
              }

              return matches;
            }) || null;
          }

          if (!row) {
            console.warn('[App] Could not locate row for property', { prop, idx, method });
          } else {
            // Debug: Show ALL columns of the matched operational dataframe row
            console.log('[App] OPERATIONAL DATAFRAME ROW - All columns:', row);
            console.log('[App] OPERATIONAL DATAFRAME ROW - Column names:', Object.keys(row));
          }

          // Process evidence
          const rawEvidence = (prop as any).evidence;
          let ev: string[] = [];

          if (Array.isArray(rawEvidence)) {
            // Already an array
            ev = rawEvidence;
          } else if (rawEvidence && typeof rawEvidence === 'string') {
            // Parse comma-separated quoted strings: "\"text1\", \"text2\", \"text3\""
            // Split on quote/comma patterns: ", " between double-quoted items
            const trimmed = rawEvidence.trim();
            const parts = trimmed.split(/"\s*,\s*"|\n|,\s(?=[\w\d])/g).map(s => s.replace(/^"|"$/g, '').trim());
            ev = parts.filter(Boolean);
          } else if (rawEvidence) {
            // Single value, wrap in array
            ev = [String(rawEvidence)];
          }

          console.log('[App] onOpenProperty - Raw evidence:', rawEvidence);
          console.log('[App] onOpenProperty - Parsed evidence array:', ev);
          console.log('[App] onOpenProperty - Evidence count:', ev.length);
          console.log('[App] onOpenProperty - First evidence item:', ev[0]);
          console.log('[App] onOpenProperty - Evidence target model:', (prop as any).model);

          setSelectedEvidence(ev);
          setEvidenceTargetModel((prop as any).model);
          setSelectedProperty(prop);

          if (row) {
            onView(row, true);
          }
        }}
      />
    );
  }, [activeSection, propertiesRows, currentRows, operationalRows, method, onView]);



  // reserved: server-validated grouped rows loader (not used in current UI)



  const clearCustomCode = useCallback(() => {
    setCustomCode("");
    setCustomError(null);
  }, []);

  // Memoized callbacks to prevent unnecessary effect triggers in children
  const getPropertiesRowsCb = useCallback(() => propertiesRows, [propertiesRows]);
  const getOperationalRowsCb = useCallback(() => operationalRows, [operationalRows]);

  // Extraction panel callbacks
  const onPropertiesMergedCb = useCallback((props: any[]) => {
    console.log('[App] onPropertiesMergedCb - Received properties:', {
      count: props.length,
      firstProp: props[0],
      operationalRowsCount: operationalRowsRef.current.length,
      method: methodRef.current
    });

    setPropertiesByKey(prevMap => {
      const newMap = new Map(prevMap);
      props.forEach(p => {
        const key = `${p.question_id}-${p.model}`;
        if (!newMap.has(key)) newMap.set(key, []);
        newMap.get(key)!.push(p);
      });
      return newMap;
    });

    // Also update propertiesRows for the PropertiesTab
    // Enrich new properties with model_response from operational data
    const enrichedProps = props.map((prop, propIdx) => {
      console.log(`[App] onPropertiesMergedCb - Enriching property ${propIdx}:`, {
        question_id: prop.question_id,
        model: prop.model,
        question_id_type: typeof prop.question_id,
        model_type: typeof prop.model
      });

      // Find matching operational row by question_id and model
      const matchingRow = operationalRowsRef.current.find(opRow => {
        if (methodRef.current === 'single_model') {
          const matches = opRow.question_id === prop.question_id && opRow.model === prop.model;
          if (!matches && propIdx === 0) {
            // Debug first property match attempt
            console.log('[App] Checking opRow:', {
              opRow_qid: opRow.question_id,
              opRow_qid_type: typeof opRow.question_id,
              opRow_model: opRow.model,
              opRow_model_type: typeof opRow.model,
              prop_qid: prop.question_id,
              prop_model: prop.model,
              qid_match: opRow.question_id === prop.question_id,
              model_match: opRow.model === prop.model
            });
          }
          return matches;
        } else if (methodRef.current === 'side_by_side') {
          return opRow.question_id === prop.question_id &&
            (opRow.model_a === prop.model || opRow.model_b === prop.model);
        }
        return false;
      });

      console.log(`[App] onPropertiesMergedCb - Match result for property ${propIdx}:`, {
        found: !!matchingRow,
        __index: matchingRow?.__index,
        matchingRow_qid: matchingRow?.question_id,
        matchingRow_model: matchingRow?.model
      });

      // Add model_response and __index from the matching operational row
      return {
        ...prop,
        __index: matchingRow?.__index,
        model_response: matchingRow?.model_response ||
          matchingRow?.model_a_response ||
          matchingRow?.model_b_response ||
          'No response found'
      };
    });

    console.log('[App] onPropertiesMergedCb - Enriched properties:', {
      count: enrichedProps.length,
      firstEnriched: enrichedProps[0],
      hasIndex: enrichedProps[0]?.__index !== undefined
    });

    // Add to existing propertiesRows (for single extraction, we append)
    setPropertiesRows(prevRows => [...prevRows, ...enrichedProps]);
    // Don't auto-switch tabs - stay in extraction step
  }, []);

  const onBatchLoadedCb = useCallback((rows: any[]) => {
    // Enrich properties with model_response from operational data
    const enrichedRows = rows.map(prop => {
      // Find matching operational row by question_id and model
      const matchingRow = operationalRowsRef.current.find(opRow => {
        if (methodRef.current === 'single_model') {
          return opRow.question_id === prop.question_id && opRow.model === prop.model;
        } else if (methodRef.current === 'side_by_side') {
          return opRow.question_id === prop.question_id &&
            (opRow.model_a === prop.model || opRow.model_b === prop.model);
        }
        return false;
      });

      // Add model_response and __index from the matching operational row
      return {
        ...prop,
        __index: matchingRow?.__index,
        model_response: matchingRow?.model_response ||
          matchingRow?.model_a_response ||
          matchingRow?.model_b_response ||
          'No response found'
      };
    });

    setPropertiesRows(enrichedRows);
    // Don't auto-switch tabs - stay in extraction step to see properties in panel
  }, []);

  const onBatchDoneCb = useCallback(() => {
    setBatchRunning(false);
    setPipelineStage('idle');
  }, []);

  const onClustersUpdatedCb = useCallback((data: any) => {
    if (!data) {
      console.error('❌ onClustersUpdated received undefined/null data');
      return;
    }

    // Show the clustering complete alert when new clusters arrive
    setClusteringAlertDismissed(false);
    setClusteringJustCompleted(true);

    // Enrich clusters with per-model quality data from metrics
    let enrichedClusters = data.clusters || [];
    if (data.metrics?.model_cluster_scores) {
      const normalizedMetrics = normalizeMetricsColumnNames(data.metrics);

      // Enrich model_cluster_scores with cluster metadata (meta.group)
      if (normalizedMetrics.model_cluster_scores) {
        normalizedMetrics.model_cluster_scores = enrichModelClusterScoresWithMetadata(
          normalizedMetrics.model_cluster_scores,
          data.clusters || []
        );
      }

      enrichedClusters = enrichClustersWithQualityData(
        data.clusters || [],
        normalizedMetrics.model_cluster_scores
      );

      // Build a map of examples by cluster label (metrics rows group by 'cluster' label)
      const examplesByCluster = new Map<string, any[]>();
      normalizedMetrics.model_cluster_scores.forEach((row: any) => {
        const labelKey = String(row.cluster ?? '');
        const hasExamples = Array.isArray(row.examples) && row.examples.length > 0;
        if (!hasExamples) return;
        const existing = examplesByCluster.get(labelKey) || [];
        examplesByCluster.set(labelKey, existing.concat(row.examples));
      });

      // Enrich clusters with examples from model_cluster_scores (label match)
      enrichedClusters = enrichedClusters.map(cluster => {
        const labelKey = cluster.cluster_label || cluster.label || cluster.cluster || '';
        const examples = examplesByCluster.get(String(labelKey)) || [];
        return {
          ...cluster,
          examples
        };
      });
    }

    // Set clusters once with all enrichments (quality + examples)
    setClusters(ensureExamplesArray(enrichedClusters));
    setTotalConversationsByModel(data.total_conversations_by_model || null);
    setTotalUniqueConversations(data.total_unique_conversations || null);

    // Save metrics so they appear in the Metrics tab
    if (data.metrics) {
      const normalizedMetrics = normalizeMetricsColumnNames(data.metrics);

      // Enrich model_cluster_scores with cluster metadata (meta.group)
      if (normalizedMetrics.model_cluster_scores) {
        normalizedMetrics.model_cluster_scores = enrichModelClusterScoresWithMetadata(
          normalizedMetrics.model_cluster_scores,
          data.clusters || []
        );
      }

      console.log('📊 resultsMetrics set:', normalizedMetrics.model_scores?.length || 0, 'model_scores');
      setResultsMetrics(normalizedMetrics);
    }
  }, []);

  const onNavigateToMetricsCb = useCallback(() => {
    // Navigate to Insights step when clustering + metrics are ready
    setActiveSection('metrics');
    setSidebarExpanded(false);
  }, []);

  const onNavigateToClustersCb = useCallback(() => {
    // Navigate to Clusters view when clustering is ready
    setActiveSection('clusters');
    setSidebarExpanded(false);
  }, []);

  // Reusable download results function
  const handleDownloadResults = useCallback(async () => {
    try {
      const zip = new JSZip();
      zip.file('clusters.jsonl', clusters.map(c => JSON.stringify(c)).join('\n'));
      zip.file('properties.jsonl', propertiesRows.map(p => JSON.stringify(p)).join('\n'));

      if (operationalRows.length > 0) {
        zip.file('conversations.jsonl', operationalRows.map(r => JSON.stringify(r)).join('\n'));
      }

      if (resultsMetrics?.model_cluster_scores && resultsMetrics.model_cluster_scores.length > 0) {
        zip.file('model_cluster_scores_df.jsonl',
          resultsMetrics.model_cluster_scores.map(m => JSON.stringify(m)).join('\n'));
      }

      if (resultsMetrics?.cluster_scores && resultsMetrics.cluster_scores.length > 0) {
        zip.file('cluster_scores_df.jsonl',
          resultsMetrics.cluster_scores.map(m => JSON.stringify(m)).join('\n'));
      }

      if (resultsMetrics?.model_scores && resultsMetrics.model_scores.length > 0) {
        zip.file('model_scores_df.jsonl',
          resultsMetrics.model_scores.map(m => JSON.stringify(m)).join('\n'));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const baseName = resultsName.trim() || uploadedFileName || 'clustering_results';
      const filename = `${baseName}_${new Date().toISOString().slice(0, 10)}.zip`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download results');
    }
  }, [clusters, propertiesRows, operationalRows, resultsMetrics, resultsName, uploadedFileName]);

  // Auto-download results when clustering completes
  React.useEffect(() => {
    if (clusteringJustCompleted && clusters.length > 0 && !batchRunning) {
      // Trigger download after a short delay to ensure all state updates are complete
      const timer = setTimeout(() => {
        handleDownloadResults();
        setClusteringJustCompleted(false); // Reset flag so we don't auto-download again
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [clusteringJustCompleted, clusters.length, batchRunning, handleDownloadResults]);

  // Metrics tab data callback - memoized to avoid infinite effect loops
  const onMetricsDataProcessedCb = useCallback((data: {
    availableModels: string[];
    availableGroups: string[];
    availableBehaviorTypes: string[];
    availableQualityMetrics: string[];
    summary: MetricsSummary | null;
  }) => {
    setMetricsAvailableModels(data.availableModels);
    setMetricsAvailableGroups(data.availableGroups);
    setMetricsAvailableQualityMetrics(data.availableQualityMetrics);
    setMetricsSummary(data.summary);

    // Auto-select sensible defaults if not set yet
    setMetricsFilters(prev => {
      const updates: Partial<MetricsFilters> = {};

      if (!prev.qualityMetric && data.availableQualityMetrics.length > 0) {
        updates.qualityMetric = data.availableQualityMetrics[0];
      }

      if (prev.selectedModels.length === 0 && data.availableModels.length > 0) {
        updates.selectedModels = data.availableModels;
      }

      if (prev.selectedMetrics.length === 0 && data.availableQualityMetrics.length > 0) {
        updates.selectedMetrics = data.availableQualityMetrics;
      }

      // Set default behavior types: all except 'positive'
      if (prev.selectedBehaviorTypes.length === 0 && data.availableBehaviorTypes && data.availableBehaviorTypes.length > 0) {
        updates.selectedBehaviorTypes = data.availableBehaviorTypes.filter(bt => bt !== 'positive');
      }

      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, []);

  // More extraction panel callbacks - memoize to prevent infinite loops
  const getSelectedRowCb = useCallback(() => {
    // Prioritize the row being viewed in the trace drawer, otherwise use the default selection
    return (drawerOpen && selectedRow) ? selectedRow : selectedRowForExtraction;
  }, [drawerOpen, selectedRow, selectedRowForExtraction]);

  const getAllRowsCb = useCallback(() => currentRows, [currentRows]);

  // Scroll to properties table callback
  const scrollToPropertiesCb = useCallback(() => {
    if (propertiesSectionRef.current) {
      // Get the element's position
      const element = propertiesSectionRef.current;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;

      // Offset to account for overview banner (~100px) and some padding
      const offset = 120;

      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  }, []);

  const onBatchStartCb = useCallback(() => {
    setBatchRunning(true);
    setPipelineStage('extraction');
  }, []);

  const onBatchStatusCb = useCallback((progress: number, state: string | null, stage?: 'extraction' | 'clustering', details?: string) => {
    setBatchProgress(progress);
    setBatchState(state);
    if (stage === 'clustering') {
      setPipelineStage('clustering');
    } else if (stage === 'extraction') {
      setPipelineStage('extraction');
    }
    console.log(`Batch status: ${stage} - ${state} - ${details}`);
  }, []);

  const onRequestRecomputeCb = useCallback((included_property_ids?: string[]) => {
    (async () => {
      try {
        // Transform operationalRows to backend-expected format
        const transformedRows = transformRowsForBackend(operationalRows, method);

        console.log('🔍 TRANSFORMATION DEBUG:', {
          method,
          originalSample: operationalRows[0],
          transformedSample: transformedRows[0],
          originalCount: operationalRows.length,
          transformedCount: transformedRows.length,
          note: 'Scores are in nested dict format, no score_columns param needed'
        });

        // For side-by-side: create model-to-column mapping
        // Note: After transformation, this is no longer needed since we use arrays
        let modelColumnMap: Record<string, string> | undefined;
        if (method === 'side_by_side' && operationalRows[0]) {
          const firstRow = operationalRows[0];
          modelColumnMap = {};
          if (firstRow.model_a) {
            modelColumnMap[firstRow.model_a] = 'model_a';
          }
          if (firstRow.model_b) {
            modelColumnMap[firstRow.model_b] = 'model_b';
          }
        }

        console.log('🔍 SENDING TO BACKEND:', {
          transformedRows_sample: transformedRows[0],
          method: method,
          model_column_map: modelColumnMap,
          note: 'Scores in nested dict format - backend will process all keys'
        });

        const res = await recomputeClusterMetrics({
          clusters,
          properties: propertiesRows,
          operationalRows: transformedRows,
          included_property_ids,
          // score_columns omitted - scores in nested dict, backend processes all keys
          method,
          model_column_map: modelColumnMap,
          // Enable confidence intervals for metrics recomputation
          metrics_kwargs: {
            compute_confidence_intervals: true,
            bootstrap_samples: 100,
          },
        });

        // Re-enrich clusters with quality data from cached metrics
        let updatedClusters = res.clusters || [];
        if (resultsMetrics?.model_cluster_scores) {
          updatedClusters = enrichClustersWithQualityData(
            updatedClusters,
            resultsMetrics.model_cluster_scores
          );
        }

        setClusters(ensureExamplesArray(updatedClusters));
      } catch (e) {
        console.error('recompute (filters) failed', e);
      }
    })();
  }, [clusters, propertiesRows, operationalRows, resultsMetrics, method]);

  // Utility: Guarantee examples is always an array when setting clusters
  const ensureExamplesArray = (clusters) => (clusters || []).map(c => ({ ...c, examples: c.examples || [] }));

  // View Clusters navigation handler - opens cluster sidecard
  const handleNavigateToCluster = (clusterName: string) => {
    // Find the cluster by name/label
    const cluster = clusters.find((c: any) =>
      String(c.label || c.cluster_label || '').toLowerCase() === clusterName.toLowerCase()
    );
    if (cluster) {
      console.log('[App] Opening cluster sidecard:', clusterName);
      console.log('[App] Cluster data:', cluster);
      console.log('[App] Has quality_delta_by_model?', !!cluster.meta?.quality_delta_by_model);
      setSelectedCluster(cluster);
      setClusterSidecardOpen(true);
    } else {
      console.warn('[App] Could not find cluster with name:', clusterName);
      console.warn('[App] Available clusters:', clusters.map((c: any) => c.label || c.cluster_label));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {resultsError && (
        <Box sx={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1500 }}>
          <Box sx={{
            px: 2, py: 1, borderRadius: 1, border: '1px solid', borderColor: 'error.light',
            backgroundColor: '#FEF2F2', color: '#7F1D1D', display: 'flex', alignItems: 'center', gap: 2
          }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Error</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{resultsError}</Typography>
            <Button size="small" variant="outlined" onClick={() => setResultsError(null)} sx={{ ml: 'auto' }}>Dismiss</Button>
          </Box>
        </Box>
      )}
      <AppBar position="fixed" ref={appBarRef}>
        <Toolbar sx={{ gap: 0, pl: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              ml: -1,
              cursor: 'pointer'
            }}
            onClick={() => resetUiStateForNewSource('file')}
          >
            <Box
              component="img"
              src="/icon.png"
              alt="StringSight icon"
              sx={{ width: 40, height: 40 }}
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexGrow: 1,
              ml: 1,
              cursor: 'pointer'
            }}
            onClick={() => resetUiStateForNewSource('file')}
          >
            <Typography variant="h6">StringSight</Typography>
            <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
              Automatically analyze your traces
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {isLoadingResults && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: 320 }}>
                <LinearProgress sx={{ flexGrow: 1 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  {resultsLoadingMessage || 'Loading...'}
                </Typography>
              </Box>
            )}
            {isAuthenticated ? (
              <Button
                variant="outlined"
                size="small"
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
              >
                Logout
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setLoginOpen(true)}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
              >
                Login
              </Button>
            )}
            <Button
              variant="contained"
              component="label"
              size="small"
              sx={{
                color: 'white',
                backgroundColor: 'primary.main', // Uses retro blue from theme
                '&:hover': {
                  backgroundColor: '#3A7BC8', // Darker retro blue on hover
                }
              }}
            >
              Upload File
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".csv,.json,.jsonl"
                onChange={onFileChange}
              />
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={(e) => setResultsMenuAnchor(e.currentTarget)}
              sx={{
                color: 'white',
                backgroundColor: 'secondary.main', // Uses retro purple from theme
                '&:hover': {
                  backgroundColor: '#7A4FAF', // Darker retro purple on hover
                }
              }}
            >
              Load Results
            </Button>
            <Menu
              anchorEl={resultsMenuAnchor}
              open={Boolean(resultsMenuAnchor)}
              onClose={() => setResultsMenuAnchor(null)}
            >
              <MenuItem
                onClick={() => {
                  setResultsMenuAnchor(null);
                  // Small delay to ensure menu closes before file picker opens
                  setTimeout(() => {
                    resultsInputRef.current?.click();
                  }, 100);
                }}
              >
                Load Folder
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setResultsMenuAnchor(null);
                  // Small delay to ensure menu closes before file picker opens
                  setTimeout(() => {
                    resultsZipInputRef.current?.click();
                  }, 100);
                }}
              >
                Load Zip File
              </MenuItem>
            </Menu>
            {/* Hidden file inputs */}
            <input
              ref={resultsInputRef}
              type="file"
              style={{ display: 'none' }}
              /* @ts-ignore - webkitdirectory is not in TypeScript types but widely supported */
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  void onLoadResultsLocal(files);
                }
              }}
            />
            <input
              ref={resultsZipInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".zip"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void onLoadResultsZip(file);
                }
              }}
            />

          </Stack>
        </Toolbar>
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} onLoginSuccess={() => { setIsAuthenticated(true); setLoginOpen(false); }} />
        <DemoModeSelector
          open={demoModeSelectorOpen}
          onClose={() => setDemoModeSelectorOpen(false)}
          onSelect={(mode) => {
            setDemoModeSelectorOpen(false);
            onLoadDemoData(mode);
          }}
        />
        {/* Global extraction/clustering progress, visible from all stages */}
        {batchRunning && (
          <Box sx={{ px: 3, pb: 1.5 }}>
            <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.5 }}>
              {pipelineStage === 'extraction' && batchState
                ? `Extracting properties: ${batchState} • ${Math.round((batchProgress || 0) * 100)}%`
                : pipelineStage === 'clustering'
                  ? 'Clustering properties... (this may take a few minutes, please don\'t close your browser)'
                  : 'Processing...'}
            </Typography>
            <LinearProgress
              variant={
                pipelineStage === 'extraction' && (batchProgress || 0) > 0
                  ? 'determinate'
                  : 'indeterminate'
              }
              value={(batchProgress || 0) * 100}
            />
          </Box>
        )}
        {/* Clustering complete message */}
        {clusters.length > 0 && !clusteringAlertDismissed && !isResultsMode && (
          <Box sx={{ px: 3, pb: 1.5 }}>
            <Alert
              severity="success"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#065F46',
                '& .MuiAlert-icon': {
                  color: '#10B981'
                }
              }}
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  {clusters.length > 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setActiveSection('clusters');
                        setSidebarExpanded(false);
                      }}
                      sx={{
                        color: '#065F46',
                        borderColor: 'rgba(6, 95, 70, 0.5)',
                        '&:hover': {
                          borderColor: '#065F46',
                          backgroundColor: 'rgba(6, 95, 70, 0.1)'
                        }
                      }}
                    >
                      View Clusters
                    </Button>
                  )}
                  {resultsMetrics && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setActiveSection('metrics');
                        setSidebarExpanded(false);
                      }}
                      sx={{
                        backgroundColor: '#10B981',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: '#059669'
                        }
                      }}
                    >
                      View Insights
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadResults}
                    sx={{
                      color: '#065F46',
                      borderColor: 'rgba(6, 95, 70, 0.5)',
                      '&:hover': {
                        borderColor: '#065F46',
                        backgroundColor: 'rgba(6, 95, 70, 0.1)'
                      }
                    }}
                  >
                    Download Results
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => setClusteringAlertDismissed(true)}
                    sx={{
                      color: '#065F46',
                      ml: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(6, 95, 70, 0.1)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#065F46' }}>
                Clustering complete!
              </Typography>
              <Typography variant="body2" sx={{ color: '#047857' }}>
                Your properties have been clustered and insights are ready. Navigate to the <strong>Cluster Behaviors</strong> or <strong>View Insights</strong> section to explore the results.
              </Typography>
            </Alert>
          </Box>
        )}
      </AppBar>
      {/* offset for fixed AppBar - dynamically calculated to account for progress bar and clustering message */}
      <Box sx={{ height: `${appBarHeight}px` }} />

      {/* Permanent Icon Sidebar */}
      <PermanentIconSidebar
        activeSection={activeSection}
        sidebarExpanded={sidebarExpanded}
        onSectionChange={(section) => {
          setActiveSection(section);

          const hasGlobalProperties = propertiesRows.length > 0;
          const hasClusters = clusters.length > 0;
          const hasMetrics = !!resultsMetrics;

          if (section === 'data') {
            setSidebarExpanded(false);
          } else if (section === 'extraction') {
            // Clear highlight when user clicks extraction
            setHighlightExtractionIcon(false);
            // When properties exist, focus on the extraction/properties view.
            // Otherwise, the data table remains visible while the extraction panel guides setup.
            if (!hasGlobalProperties) {
              console.log('📊 Extraction selected with no properties yet; keeping data table visible for context');
            }
            setSidebarExpanded(true);
          } else if (section === 'clusters') {
            if (!hasClusters) {
              console.log('📊 Clusters section selected but no clusters are available yet');
            }
            setSidebarExpanded(false);
          } else if (section === 'metrics') {
            if (!hasMetrics) {
              console.log('📊 Metrics section selected but no metrics are available yet');
            }
            setSidebarExpanded(false);
          }
        }}
        highlightExtraction={highlightExtractionIcon}
        canGoToClusters={clusters.length > 0}
        canGoToMetrics={!!resultsMetrics}
        dataDone={operationalRows.length > 0}
        extractionDone={propertiesRows.length > 0}
        clustersDone={clusters.length > 0}
        metricsDone={!!resultsMetrics}
        currentStage={pipelineStage}
        onDownloadResults={clusters.length > 0 ? handleDownloadResults : undefined}
      />

      {/* Removed expand chevron button; opening is handled by clicking icon sidebar */}

      <Container maxWidth={false} sx={{
        py: 1,
        pt: 2, // Reduced top padding below header
        px: 3, // Global horizontal padding for all tabs
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        ml: '150px', // Account for permanent icon sidebar (150px wide)
        mr: 0, // No right margin
        width: 'calc(100vw - 150px)', // Constrain width to account for icon sidebar (150px)
        maxWidth: 'none', // Override default maxWidth
        overflow: 'auto' // Ensure proper scroll containment
      }}>
        {/* Left control sidebar is always available (collapsed by default via width + Drawer) */}
        {/* Getting started helper - shown before any upload */}
        {originalRows.length === 0 && !showColumnSelector && !isResultsMode && (
          <Box sx={{
            mb: 2, py: 3, px: 2, borderRadius: 2,
            background: '#F8FAFC', color: 'text.secondary'
          }}>
            <Box sx={{ textAlign: 'left', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ color: '#374151' }}>Easily Visualize and Analyze your Model Outputs</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Tooltip title="Starter Notebook">
                    <IconButton
                      component="a"
                      href={EXTERNAL_LINKS.STARTER_NOTEBOOK}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ color: 'primary.main' }}
                    >
                      <CodeIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="GitHub Repository">
                    <IconButton
                      component="a"
                      href={EXTERNAL_LINKS.GITHUB}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ color: 'primary.main' }}
                    >
                      <GitHubIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Documentation">
                    <IconButton
                      component="a"
                      href={EXTERNAL_LINKS.DOCUMENTATION}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ color: 'primary.main' }}
                    >
                      <MenuBookIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setDemoModeSelectorOpen(true)}
                  startIcon={<PlayArrowIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: retroColors.green, // Retro terminal green
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    '&:hover': {
                      backgroundColor: '#3D9B73', // Darker retro green on hover
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  Try Demo Data
                </Button>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>1) Upload your dataset (.jsonl, .json, or .csv)</Typography>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>2) Select which columns correspond to your prompts, responses, models, and scores</Typography>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>3) Click Done to load your table and explore</Typography>

              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#374151', fontWeight: 600, mb: 1 }}>What data format should I use?</Typography>
                <Typography variant="body2" sx={{ color: '#374151', mb: 1.5, fontSize: '0.875rem' }}>
                  StringSight accepts <strong>.jsonl</strong>, <strong>.json</strong>, or <strong>.csv</strong> files with the following:
                </Typography>

                <Typography variant="body2" sx={{ color: '#374151', fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                  Required:
                </Typography>
                <Box component="ol" sx={{ color: '#374151', fontSize: '0.875rem', ml: 3, mb: 1.5, pl: 0 }}>
                  <li>
                    <strong>The prompt/task identifier</strong> - any identifier for the specific task (can be the actual prompt or a unique ID)
                  </li>
                  <li>
                    <strong>The model response</strong> - can be in OpenAI format (multi-turn conversations), a single string (agentic traces, reasoning chains), or your own custom format. Note: strings and custom formats will appear as single-turn traces.
                  </li>
                </Box>

                <Typography variant="body2" sx={{ color: '#374151', fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                  Optional:
                </Typography>
                <Box component="ol" start={3} sx={{ color: '#374151', fontSize: '0.875rem', ml: 3, mb: 1.5, pl: 0 }}>
                  <li>
                    <strong>Model name</strong> - include if analyzing multiple models, methods, or prompts (e.g., model name, agent scaffolding, prompt variant)
                  </li>
                  <li>
                    <strong>Scores</strong> - any numerical evaluation metrics (accuracy, harmfulness, etc.). Can be separate columns or a single 'score' column with format: <code>{`{"metric1": value, "metric2": value}`}</code>
                  </li>
                </Box>

                <Typography variant="body2" sx={{ color: '#374151', mb: 2, fontSize: '0.875rem', fontStyle: 'italic' }}>
                  You can name these columns whatever you want and assign them during upload.
                </Typography>

                <ExampleFormatTabs />
              </Box>
            </Box>
          </Box>
        )}

        {/* Column Selector - shown when user needs to specify column mapping */}
        {showColumnSelector && (
          <ColumnSelector
            columns={availableColumns}
            rows={originalRows}
            onMappingChange={handleMappingChange}
            onValidationChange={handleValidationChange}
            onCancel={() => setShowColumnSelector(false)}
            autoDetectedMapping={autoDetectedMapping || undefined}
          />
        )}

        {/* Show data interface only after data is loaded and column mapping is complete */}
        {originalRows.length > 0 && !showColumnSelector && (
          <>
            {/* Show filter notice if any rows were dropped due to missing scores */}
            {filterNotice && (
              <Box
                sx={{
                  mb: 1,
                  p: 1.5,
                  border: '1px solid #F59E0B',
                  background: '#FFFBEB',
                  color: '#92400E',
                  borderRadius: 1,
                }}
              >
                {filterNotice}
              </Box>
            )}

            {activeSection === 'data' && dataOverview && (
              <DataOverviewBanner dataOverview={dataOverview} method={method} />
            )}

            {/* Hint message for extraction feature - shown when data is loaded but no properties (demo mode or demo data loaded) */}
            {(isDemoMode || uploadedFileName.includes('taubench_airline')) && activeSection === 'data' && originalRows.length > 0 && !showColumnSelector && propertiesRows.length === 0 && (
              <Box
                sx={{
                  mb: 2,
                  px: 2,
                  py: 1.5,
                  backgroundColor: '#EFF6FF',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <ArrowBackIcon sx={{ color: 'primary.main', fontSize: 32 }} />
                <FindInPageIcon sx={{ color: '#10B981', fontSize: 28 }} />
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Click <strong>'Label Behaviors'</strong> in the sidebar to analyze your traces
                </Typography>
              </Box>
            )}

            {/* Extraction panel in main content for Extraction step */}
            {activeSection === 'extraction' && (
              <Box sx={{ mb: 2, position: 'relative' }}>
                <PropertyExtractionPanel
                  method={method}
                  uploadedFileName={uploadedFileName}
                  resultsName={resultsName}
                  onResultsNameChange={setResultsName}
                  isResultsMode={isResultsMode}
                  demoSampleSize={isDemoMode || isDemoSession ? demoSampleSize : undefined} // Modified
                  getSelectedRow={getSelectedRowCb}
                  getAllRows={getAllRowsCb}
                  getOperationalRows={getOperationalRowsCb}
                  getPropertiesRows={getPropertiesRowsCb}
                  getClusters={() => clusters}
                  onPropertiesMerged={onPropertiesMergedCb}
                  onSelectEvidence={setSelectedEvidence}
                  onBatchLoaded={onBatchLoadedCb}
                  onBatchStart={onBatchStartCb}
                  onBatchStatus={onBatchStatusCb}
                  onBatchDone={onBatchDoneCb}
                  onClustersUpdated={onClustersUpdatedCb}
                  onNavigateToMetrics={onNavigateToMetricsCb}
                  onNavigateToClusters={onNavigateToClustersCb}
                  onScrollToProperties={scrollToPropertiesCb}
                  onOpenTrace={(row) => {
                    // Format trace data properly based on method (same as onView function)
                    if (method === "single_model") {
                      const messages = ensureOpenAIFormat(String(row?.["prompt"] ?? ""), row?.["model_response"]);
                      setSelectedTrace({ type: "single", messages });
                    } else if (method === "side_by_side") {
                      const prompt = String(row?.["prompt"] ?? "");
                      const messagesA = ensureOpenAIFormat(prompt, row?.["model_a_response"]);
                      const messagesB = ensureOpenAIFormat(prompt, row?.["model_b_response"]);
                      setSelectedTrace({
                        type: "sbs",
                        messagesA,
                        messagesB,
                        modelA: String(row?.["model_a"] ?? "Model A"),
                        modelB: String(row?.["model_b"] ?? "Model B"),
                      });
                    }
                    setSelectedRow(row);
                    setDrawerOpen(true);
                    setSelectedEvidence(null);
                    setEvidenceTargetModel(undefined);
                  }}
                  onCloseTrace={() => {
                    setDrawerOpen(false);
                    setSelectedTrace(null);
                    setSelectedRow(null);
                    setSelectedEvidence(null);
                    setEvidenceTargetModel(undefined);
                    setSelectedProperty(null);
                  }}
                />
                {!backendAvailable && (
                  <Box sx={{ position: 'absolute', inset: 0, zIndex: (theme) => theme.zIndex.modal + 1, bgcolor: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1, pointerEvents: 'all' }}>
                    <Box sx={{ bgcolor: '#F97316', color: '#FFFFFF', px: 2, py: 1.25, borderRadius: 1, boxShadow: 4, border: '1px solid #EA580C', textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Backend not connected. Set VITE_BACKEND to your backend URL to enable extraction.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Operation Chain Summary */}
            <FilterSummary
              operations={operationChain}
              onRemoveOperation={removeOperation}
            />

            {/* Top action row: extraction hint and results download */}
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              </Box>
            </Box>

            {/* Content based on active section */}
            {/* Mount table/properties only when active to keep memory low */}
            {activeSection === 'data' ? tableContent : null}
            {activeSection === 'extraction' ? (
              <Box ref={propertiesSectionRef}>
                {propertiesContent}
              </Box>
            ) : null}
            {(activeSection === 'clusters' || hasViewedClusters) && (
              <Box sx={{ display: activeSection === 'clusters' ? 'block' : 'none' }}>
                <ClustersTab
                  clusters={clusters}
                  totalConversationsByModel={totalConversationsByModel}
                  totalUniqueConversations={totalUniqueConversations}
                  getPropertiesRows={getPropertiesRowsCb}
                  onRequestRecompute={onRequestRecomputeCb}
                  modelClusterScores={resultsMetrics?.model_cluster_scores}
                  externalSearchQuery={clusterSearchQuery}
                  onClusterClick={(cluster) => {
                    console.log('[App] onClusterClick called with cluster:', cluster);
                    setSelectedCluster(cluster);
                    setClusterSidecardOpen(true);
                    console.log('[App] Sidecard state set to open');
                  }}
                />
              </Box>
            )}
            {activeSection === 'metrics' && (
              <Box>
                {resultsMetrics ? (
                  <MetricsTab
                    resultsData={resultsMetrics}
                    filters={metricsFilters}
                    onFiltersChange={setMetricsFilters}
                    totalUniqueConversations={totalUniqueConversations}
                    method={method}
                    onDataProcessed={onMetricsDataProcessedCb}
                    onNavigateToCluster={handleNavigateToCluster}
                    onViewExample={(cluster) => {
                      // Randomly select an example from the cluster
                      if (!cluster.examples || cluster.examples.length === 0) return;

                      const randomIndex = Math.floor(Math.random() * cluster.examples.length);
                      const selectedExample = cluster.examples[randomIndex];

                      console.log('[App] onViewExample - Selected example:', selectedExample);
                      console.log('[App] onViewExample - Cluster model:', cluster.model);

                      // Example format: [question_id, {predicted_text: "..."}, {property_description: "..."}]
                      const questionId = selectedExample[0];
                      const propertyData = selectedExample[2]; // Third element contains property_description
                      const propertyDescription = propertyData?.property_description;

                      console.log('[App] onViewExample - Looking for property:', {
                        questionId,
                        model: cluster.model,
                        propertyDescription,
                        totalProperties: propertiesRows.length
                      });

                      // Find the matching property in propertiesRows
                      const prop = propertiesRows.find((p: any) => {
                        const matchesQid = String(p.question_id) === String(questionId);
                        const matchesModel = String(p.model) === String(cluster.model);
                        const matchesDescription = String(p.property_description) === String(propertyDescription);

                        // Debug: log properties that match on question_id
                        if (matchesQid) {
                          console.log('[App] onViewExample - Found property with matching qid:', {
                            qid: p.question_id,
                            model: p.model,
                            description: p.property_description,
                            matchesModel,
                            matchesDescription
                          });
                        }

                        return matchesQid && matchesModel && matchesDescription;
                      });

                      if (!prop) {
                        console.warn('[App] onViewExample - Could not find property for example');
                        console.warn('[App] onViewExample - First 3 properties:', propertiesRows.slice(0, 3));
                        return;
                      }

                      // Find the corresponding row in operationalRows (same as onOpenPropertyById)
                      const idx = (prop as any).__index ?? (prop as any).row_index;
                      let row: any | null = null;
                      if (idx != null) {
                        row = operationalRows.find(r => Number(r?.__index) === Number(idx)) || null;
                      }
                      if (!row) {
                        const qid = (prop as any).question_id;
                        const modelName = String((prop as any).model || '');
                        row = operationalRows.find(r => {
                          const rq = r?.question_id;
                          if (method === 'single_model') {
                            return rq === qid && String(r?.model || '') === modelName;
                          } else if (method === 'side_by_side') {
                            return rq === qid && (String(r?.model_a || '') === modelName || String(r?.model_b || '') === modelName);
                          }
                          return false;
                        }) || null;
                      }

                      if (!row) {
                        console.warn('[App] onViewExample - Could not find row for property');
                        return;
                      }

                      // Process evidence (same logic as onOpenPropertyById)
                      const rawEvidence = (prop as any).evidence;
                      let ev: string[] = [];

                      if (Array.isArray(rawEvidence)) {
                        ev = rawEvidence;
                      } else if (rawEvidence && typeof rawEvidence === 'string') {
                        // Parse comma-separated quoted strings
                        // Split on quote/comma patterns: ", " between double-quoted items
                        const trimmed = rawEvidence.trim();
                        const parts = trimmed.split(/"\s*,\s*"|\n|,\s(?=[\w\d])/g).map(s => s.replace(/^"|"$/g, '').trim());
                        ev = parts.filter(Boolean);
                      } else if (rawEvidence) {
                        ev = [String(rawEvidence)];
                      }

                      console.log('[App] onViewExample - Setting evidence:', ev);
                      console.log('[App] onViewExample - Property:', prop);

                      // Set property context and evidence
                      setSelectedEvidence(ev);
                      setEvidenceTargetModel((prop as any).model);
                      setSelectedProperty(prop);

                      // Open the trace with preserveEvidence=true
                      onView(row, true);
                    }}
                    debug={true}
                    showBenchmark={true}
                    showClusterPlots={false}
                    showModelCards={false}
                  />
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Metrics Data Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Load results from a folder that contains computed metrics, or run the clustering pipeline to generate metrics.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Container>



      <Drawer
        ref={drawerRef}
        anchor="right"
        open={drawerOpen}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: sidebarExpanded ? 'calc(100vw - 460px - 60px)' : 'calc(100vw - 60px - 40vw)',
            minWidth: 500,
            p: 2,
            overflow: 'auto',
            height: '100vh',
            zIndex: (theme) => theme.zIndex.drawer
          }
        }}
        ModalProps={{ keepMounted: true }}
      >
        <>
          <Box ref={traceContentRef}>
            {(selectedTrace?.type === "single" || selectedTrace?.type === "sbs") && selectedProperty && (
              // Property information header when viewing from properties table
              <PropertyTraceHeader
                selectedRow={selectedRow}
                selectedProperty={selectedProperty}
                method={method}
                evidenceTargetModel={evidenceTargetModel}
                onBack={() => {
                  setDrawerOpen(false);
                  setSelectedTrace(null);
                  setSelectedRow(null);
                  setSelectedEvidence(null);
                  setEvidenceTargetModel(undefined);
                  setSelectedProperty(null);
                }}
                onDownloadPDF={handleDrawerPrint}
                backLabel="Close"
              />
            )}
            {selectedTrace?.type === "single" && (() => {
              console.log('[App] Rendering ConversationTrace with highlights:', selectedEvidence);
              return (
                <ConversationTrace
                  messages={selectedTrace.messages}
                  highlights={selectedEvidence || undefined}
                  rawResponse={selectedRow?.model_response}
                  modelName={selectedRow?.model ? String(selectedRow.model) : undefined}
                  score={(selectedRow as any)?.score}
                  promptText={selectedRow?.prompt ? String(selectedRow.prompt) : undefined}
                  hideDownloadButton={true}
                />
              );
            })()}
            {selectedTrace?.type === "sbs" && (
              <SideBySideTrace
                messagesA={selectedTrace.messagesA}
                messagesB={selectedTrace.messagesB}
                modelA={selectedTrace.modelA}
                modelB={selectedTrace.modelB}
                highlights={selectedEvidence || undefined}
                targetModel={evidenceTargetModel}
                rawResponseA={selectedRow?.model_a_response}
                rawResponseB={selectedRow?.model_b_response}
                scoreA={(selectedRow as any)?.score_a}
                scoreB={(selectedRow as any)?.score_b}
              />
            )}
          </Box>
        </>
      </Drawer>

      {/* Cluster Sidecard */}
      <ClusterSidecard
        open={clusterSidecardOpen}
        onClose={() => {
          setClusterSidecardOpen(false);
          setSelectedCluster(null);
        }}
        cluster={selectedCluster}
        method={method}
        decimals={3}
        getPropertiesRows={getPropertiesRowsCb}
        getOperationalRows={getOperationalRowsCb}
        modelClusterScores={resultsMetrics?.model_cluster_scores}
        totalUniqueConversations={totalUniqueConversations}
        showCI={metricsFilters.showCI}
        showSignificance={true}
      />
    </Box>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <TutorialProvider>
        <App />
      </TutorialProvider>
    </ErrorBoundary>
  );
}
