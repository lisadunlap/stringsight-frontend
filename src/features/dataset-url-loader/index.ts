/**
 * Dataset URL Loader Feature
 *
 * Isolated module for loading datasets from URLs with shareable links.
 * Can be extracted to a separate repository if needed.
 */

// Main hooks for React integration
export { useDatasetFromUrl, useDatasetLoader } from './useDatasetFromUrl';

// Core loading functions
export {
  loadDataset,
  fetchDatasetsConfig,
  getDatasetConfig,
  listDatasets,
  getDatasetNameFromUrl,
} from './datasetLoader';

export { loadDatasetFromZip, isZipUrl } from './zipLoader';

// TypeScript types
export type { DatasetConfig, DatasetsYaml, LoadedDataset } from './types';
