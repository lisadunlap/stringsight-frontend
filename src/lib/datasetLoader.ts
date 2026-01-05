/**
 * Dataset loader - loads datasets from backend based on YAML configuration
 * Supports ZIP archives served from backend's /api/results/zip endpoint
 */

import yaml from 'js-yaml';
import type { DatasetsYaml, DatasetConfig, LoadedDataset } from '../types/dataset';
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
  fileName?: string,
  datasetName?: string
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

  // Default to paginated API endpoint pattern when no cdn_url is set
  if (datasetName && fileName) {
    return `/api/results/${datasetName}/${fileName}`;
  }

  throw new Error(`Cannot construct URL for dataset: no cdn_url configured and no datasetName provided`);
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
  required: boolean = true,
  datasetName?: string
): Promise<any[] | null> {
  const url = await constructFileUrl(datasetConfig, fileName, datasetName);
  
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
 * Supports ZIP archives from /api/results/zip endpoint
 */
export async function loadDataset(datasetName: string): Promise<LoadedDataset> {
  console.log(`🔍 Loading dataset: ${datasetName}`);

  // Fetch configuration
  const datasetConfig = await getDatasetConfig(datasetName);

  console.log(`📋 Dataset config:`, datasetConfig);

  // Check if this is a ZIP file
  const datasetUrl = await constructFileUrl(datasetConfig, undefined, datasetName);
  const isZip = isZipUrl(datasetUrl);

  let conversations: any[] = [];
  let properties: any[] = [];
  let clusters: any[] = [];
  let modelClusterScores: any[] | undefined;
  let clusterScores: any[] | undefined;
  let modelScores: any[] | undefined;

  if (isZip) {
    console.log(`📦 Loading from ZIP file: ${datasetUrl}`);

    // Load from ZIP
    const zipData = await loadDatasetFromZip(datasetUrl, datasetConfig.files);
    conversations = zipData.conversations;
    properties = zipData.properties;
    clusters = zipData.clusters;
    modelClusterScores = zipData.metrics.model_cluster_scores;
    clusterScores = zipData.metrics.cluster_scores;
    modelScores = zipData.metrics.model_scores;
  } else {
    console.log(`📂 Loading individual files from: ${datasetUrl}`);

    // Load individual files - try both singular and plural forms for conversations
    let conversationsData = await loadDatasetFile(datasetConfig, 'conversations.jsonl', false, datasetName);
    if (!conversationsData) {
      conversationsData = await loadDatasetFile(datasetConfig, 'conversation.jsonl', true, datasetName);
    }
    conversations = conversationsData || [];

    properties = await loadDatasetFile(datasetConfig, 'properties.jsonl', false, datasetName) || [];
    clusters = await loadDatasetFile(datasetConfig, 'clusters.jsonl', false, datasetName) || [];

    // Load optional metrics files
    modelClusterScores = await loadDatasetFile(
      datasetConfig,
      'model_cluster_scores_df.jsonl',
      false,
      datasetName
    ) || undefined;
    clusterScores = await loadDatasetFile(
      datasetConfig,
      'cluster_scores_df.jsonl',
      false,
      datasetName
    ) || undefined;
    modelScores = await loadDatasetFile(
      datasetConfig,
      'model_scores_df.jsonl',
      false,
      datasetName
    ) || undefined;
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
 */
export function getDatasetNameFromUrl(): string | null {
  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s.length > 0);
  
  // First segment is the dataset name
  if (segments.length > 0) {
    return segments[0];
  }
  
  return null;
}

