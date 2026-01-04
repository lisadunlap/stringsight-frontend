/**
 * Library entry point for @stringsight/frontend
 * 
 * This file exports the main components, hooks, and utilities
 * so they can be imported by deployment repos.
 * 
 * Usage in deployment repo:
 *   import { App, useDatasetFromUrl } from '@stringsight/frontend'
 */

// Main App component
export { default as App } from './App';

// URL-based dataset loading hooks
export { 
  useDatasetFromUrl, 
  useDatasetLoader 
} from './hooks/useDatasetFromUrl';

// Components
export { DatasetBrowser } from './components/DatasetBrowser';
export { default as ClustersTab } from './components/ClustersTab';
export { default as PropertiesTab } from './components/PropertiesTab';
export { MetricsTab } from './components/metrics/MetricsTab';
export { default as DataTable } from './components/DataTable';
export { default as ConversationTrace } from './components/ConversationTrace';
export { default as SideBySideTrace } from './components/SideBySideTrace';

// Dataset loading utilities
export {
  loadDataset,
  getDatasetConfig,
  fetchDatasetsConfig,
  listDatasets,
  getDatasetNameFromUrl
} from './lib/datasetLoader';

// Parsing utilities
export { parseFile, inferColumns } from './lib/parse';

// API utilities (if backend is used)
export {
  detectAndValidate,
  resultsLoad,
  dfGroupPreview,
  dfCustom,
  recomputeClusterMetrics,
  checkBackendHealth
} from './lib/api';

// Context providers
export { TutorialProvider, useTutorial } from './context/TutorialContext';

// Theme
export { retroColors } from './theme';

// Type exports
export type { 
  DatasetConfig, 
  LoadedDataset, 
  DatasetsYaml 
} from './types/dataset';

export type { 
  UseDatasetFromUrlResult 
} from './hooks/useDatasetFromUrl';

export type {
  MetricsFilters,
  MetricsSummary
} from './types/metrics';

export type {
  DataOperation
} from './types/operations';

// Re-export Material-UI for convenience (optional - consumers can install directly)
// This ensures version compatibility
export { 
  ThemeProvider,
  CssBaseline 
} from '@mui/material';



