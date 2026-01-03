/**
 * Dataset loader - loads datasets from backend based on YAML configuration
 * Supports ZIP archives served from backend's /api/results/zip endpoint
 */

import * as yaml from 'js-yaml';
import type { DatasetsYaml, DatasetConfig, LoadedDataset } from './types';
import { loadDatasetFromZip, isZipUrl } from './zipLoader';

/**
 * Fetch and parse the datasets.yaml configuration file
 */
export async function fetchDatasetsConfig(): Promise<DatasetsYaml> {
  const response = await fetch('/datasets.yaml');
  if (!response.ok) {
    throw new Error(`Failed to fetch datasets.yaml: ${response.statusText}`);
  }
  const yamlText = await response.text();
  const config = yaml.load(yamlText) as DatasetsYaml;
  return config;
}

/**
 * Get dataset configuration by name
 */
export async function getDatasetConfig(datasetName: string): Promise<DatasetConfig> {
  const config = await fetchDatasetsConfig();
  const dataset = config.datasets[datasetName];
  
  if (!dataset) {
    const available = Object.keys(config.datasets).join(', ');
    throw new Error(
      `Dataset "${datasetName}" not found in configuration. Available datasets: ${available}`
    );
  }
  
  return dataset;
}

/**
 * Construct URL for a dataset file or ZIP based on configuration
 * Simply returns the cdn_url from the config (which points to backend)
 */
async function constructFileUrl(
  datasetConfig: DatasetConfig,
  fileName?: string
): Promise<string> {
  // Use direct URL from config (points to /api/results/zip/...)
  if (datasetConfig.cdn_url) {
    // If cdn_url already points to a ZIP file, use it directly
    if (isZipUrl(datasetConfig.cdn_url)) {
      return datasetConfig.cdn_url;
    }
    // Otherwise append filename (for non-ZIP datasets)
    return fileName ? `${datasetConfig.cdn_url}/${fileName}` : datasetConfig.cdn_url;
  }

  throw new Error(`Cannot construct URL for dataset: no cdn_url configured`);
}

/**
 * Parse JSONL file content into array of objects
 */
async function parseJsonl(text: string): Promise<any[]> {
  const lines = text.trim().split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/**
 * Load a single dataset file from backend
 */
async function loadDatasetFile(
  datasetConfig: DatasetConfig,
  fileName: string,
  required: boolean = true
): Promise<any[] | null> {
  const url = await constructFileUrl(datasetConfig, fileName);
  
  console.log(`📄 Loading ${fileName} from ${url.substring(0, 100)}...`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (!required) {
        console.warn(`Optional file ${fileName} not found (${response.status})`);
        return null;
      }
      throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Parse based on file extension
    if (fileName.endsWith('.jsonl')) {
      return parseJsonl(text);
    } else if (fileName.endsWith('.json')) {
      return JSON.parse(text);
    }
    
    throw new Error(`Unsupported file format: ${fileName}`);
  } catch (error) {
    if (!required) {
      console.warn(`Failed to load optional file ${fileName}:`, error);
      return null;
    }
    throw error;
  }
}

/**
 * Load complete dataset from backend based on configuration
 * Supports both new paginated API and legacy ZIP files
 */
export async function loadDataset(datasetName: string): Promise<LoadedDataset> {
  console.log(`🔍 Loading dataset: ${datasetName}`);
  const t0 = performance.now();

  // Fetch configuration
  const datasetConfig = await getDatasetConfig(datasetName);
  console.log(`📋 Dataset config:`, datasetConfig);

  let conversations: any[] = [];
  let properties: any[] = [];
  let clusters: any[] = [];
  let modelClusterScores: any[] | undefined;
  let clusterScores: any[] | undefined;
  let modelScores: any[] | undefined;

  // Determine loading strategy based on cdn_url
  const useZipFile = datasetConfig.cdn_url && isZipUrl(datasetConfig.cdn_url);
  const useFolderPath = datasetConfig.cdn_url && !isZipUrl(datasetConfig.cdn_url);

  // Strategy 1: Try paginated API (fastest)
  if (!datasetConfig.cdn_url) {
    console.log(`🚀 Loading from paginated API endpoints (dataset name: ${datasetName})...`);

    try {
      // Load all data in parallel using dataset name
      const endpoints = {
        conversations: `/api/results/${datasetName}/conversations?limit=1000`,
        properties: `/api/results/${datasetName}/properties`,
        clusters: `/api/results/${datasetName}/clusters`,
        metrics: `/api/results/${datasetName}/metrics`,
      };

      console.log(`📡 Fetching from endpoints:`, endpoints);

      const [conversationsRes, propertiesRes, clustersRes, metricsRes] = await Promise.all([
        fetch(endpoints.conversations).then(async r => {
          if (!r.ok) {
            console.error(`❌ Failed to fetch conversations: ${r.status} ${r.statusText}`);
            console.error(`   URL: ${endpoints.conversations}`);
            console.error(`   Response:`, await r.text().catch(() => 'Unable to read response'));
            return null;
          }
          return r.json();
        }),
        fetch(endpoints.properties).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  Properties not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.json();
        }),
        fetch(endpoints.clusters).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  Clusters not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.json();
        }),
        fetch(endpoints.metrics).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  Metrics not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.json();
        }),
      ]);

      conversations = conversationsRes?.data || [];
      properties = propertiesRes?.data || [];
      clusters = clustersRes?.data || [];

      if (metricsRes) {
        modelClusterScores = metricsRes.model_cluster_scores_df;
        clusterScores = metricsRes.cluster_scores_df;
        modelScores = metricsRes.model_scores_df;
      }

      if (conversations.length === 0) {
        console.error(`❌ No conversations loaded! Backend may not have this dataset.`);
        console.error(`   Dataset name: ${datasetName}`);
        console.error(`   Expected backend endpoint: /api/results/${datasetName}/conversations`);
      } else {
        console.log(`⏱️  Loaded via API in ${Math.round(performance.now() - t0)}ms`);
        console.log(`   Conversations: ${conversations.length} (first 1000 of ${conversationsRes?.total || conversations.length})`);
        console.log(`   Properties: ${properties.length}`);
        console.log(`   Clusters: ${clusters.length}`);
      }
    } catch (error) {
      console.error('❌ Failed to load from API:', error);
      console.error(`   Dataset name: ${datasetName}`);
      console.error(`   Make sure backend is running and has this dataset in final_results/`);
    }
  }

  // Strategy 2: Load from folder path (backend serves individual files)
  if (conversations.length === 0 && useFolderPath) {
    console.log(`📁 Loading from folder path: ${datasetConfig.cdn_url}`);

    try {
      const folderPath = datasetConfig.cdn_url;

      const endpoints = {
        conversations: `${folderPath}/conversations.jsonl`,
        properties: `${folderPath}/properties.jsonl`,
        clusters: `${folderPath}/clusters.jsonl`,
        metrics: `${folderPath}/model_cluster_scores_df.jsonl`,
      };

      console.log(`📡 Fetching from folder:`, endpoints);

      const [conversationsRes, propertiesRes, clustersRes, metricsRes] = await Promise.all([
        fetch(endpoints.conversations).then(async r => {
          if (!r.ok) {
            console.error(`❌ Failed to fetch conversations.jsonl: ${r.status} ${r.statusText}`);
            console.error(`   URL: ${endpoints.conversations}`);
            return null;
          }
          return r.text();
        }),
        fetch(endpoints.properties).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  properties.jsonl not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.text();
        }),
        fetch(endpoints.clusters).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  clusters.jsonl not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.text();
        }),
        fetch(endpoints.metrics).then(async r => {
          if (!r.ok) {
            console.warn(`⚠️  model_cluster_scores_df.jsonl not found (optional): ${r.status} ${r.statusText}`);
            return null;
          }
          return r.text();
        }),
      ]);

      // Parse JSONL files
      if (conversationsRes) {
        conversations = conversationsRes.trim().split('\n').map(line => JSON.parse(line));
      }
      if (propertiesRes) {
        properties = propertiesRes.trim().split('\n').filter(l => l.trim()).map(line => JSON.parse(line));
      }
      if (clustersRes) {
        clusters = clustersRes.trim().split('\n').filter(l => l.trim()).map(line => JSON.parse(line));
      }
      if (metricsRes) {
        modelClusterScores = metricsRes.trim().split('\n').filter(l => l.trim()).map(line => JSON.parse(line));
      }

      if (conversations.length === 0) {
        console.error(`❌ No conversations loaded from folder! File may not exist.`);
        console.error(`   Folder path: ${folderPath}`);
        console.error(`   Expected file: ${endpoints.conversations}`);
      } else {
        console.log(`⏱️  Loaded from folder in ${Math.round(performance.now() - t0)}ms`);
        console.log(`   Conversations: ${conversations.length}`);
        console.log(`   Properties: ${properties.length}`);
        console.log(`   Clusters: ${clusters.length}`);
      }
    } catch (error) {
      console.error('❌ Failed to load from folder path:', error);
      console.error(`   Folder path: ${datasetConfig.cdn_url}`);
      console.error(`   Make sure backend serves JSONL files from this path`);
    }
  }

  // Strategy 3: Fallback to ZIP file
  if (conversations.length === 0 && useZipFile) {
    console.log(`📦 Loading from ZIP file: ${datasetConfig.cdn_url}`);

    const zipData = await loadDatasetFromZip(datasetConfig.cdn_url, datasetConfig.files);
    conversations = zipData.conversations;
    properties = zipData.properties;
    clusters = zipData.clusters;
    modelClusterScores = zipData.metrics.model_cluster_scores;
    clusterScores = zipData.metrics.cluster_scores;
    modelScores = zipData.metrics.model_scores;
  }
  
  // Calculate totals from conversations
  const totalConversationsByModel: Record<string, number> = {};
  let totalUniqueConversations = 0;
  
  if (conversations) {
    const uniqueQuestionIds = new Set<string>();
    
    conversations.forEach((conv: any) => {
      const questionId = conv.question_id;
      if (questionId) {
        uniqueQuestionIds.add(String(questionId));
      }
      
      // Count by model
      const model = conv.model || conv.model_a;
      if (model) {
        totalConversationsByModel[model] = (totalConversationsByModel[model] || 0) + 1;
      }
    });
    
    totalUniqueConversations = uniqueQuestionIds.size;
  }
  
  const result = {
    name: datasetName,
    config: datasetConfig,
    conversations: conversations || [],
    properties: properties || [],
    clusters: clusters || [],
    metrics: {
      model_cluster_scores: modelClusterScores,
      cluster_scores: clusterScores,
      model_scores: modelScores,
    },
    total_conversations_by_model: totalConversationsByModel,
    total_unique_conversations: totalUniqueConversations,
  };

  console.log(`✅ Loaded dataset "${datasetConfig.name}":`, {
    conversations: result.conversations.length,
    properties: result.properties.length,
    clusters: result.clusters.length,
    totalUniqueConversations: result.total_unique_conversations,
    totalConversationsByModel: result.total_conversations_by_model,
    sampleConversation: result.conversations[0] ? 'Present' : 'Missing',
    conversationKeys: result.conversations[0] ? Object.keys(result.conversations[0]) : []
  });

  return result;
}

/**
 * List all available datasets from configuration
 */
export async function listDatasets(): Promise<Array<{ name: string; config: DatasetConfig }>> {
  const config = await fetchDatasetsConfig();
  return Object.entries(config.datasets).map(([name, config]) => ({ name, config }));
}

/**
 * Extract dataset name from URL path
 * Examples:
 *   /taubench_airline -> taubench_airline
 *   /taubench_airline/ -> taubench_airline
 *   /taubench_airline/some/path -> taubench_airline
 *   /results -> null (special route for dataset browser)
 */
export function getDatasetNameFromUrl(): string | null {
  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s.length > 0);

  // First segment is the dataset name, unless it's a special route
  if (segments.length > 0) {
    const firstSegment = segments[0];

    // Special routes that are not dataset names
    if (firstSegment === 'results') {
      return null;
    }

    return firstSegment;
  }

  return null;
}

