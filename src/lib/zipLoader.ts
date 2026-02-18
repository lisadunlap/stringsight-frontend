/**
 * ZIP file loader for datasets
 * Handles loading and extracting ZIP files from S3/CDN
 */

import JSZip from 'jszip';
import type { DatasetConfig, LoadedDataset, DatasetsYaml } from '../types/dataset';

/**
 * Load and extract a ZIP file from URL
 */
async function loadAndExtractZip(url: string): Promise<Map<string, string>> {
  console.log(`📦 Downloading ZIP from ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(blob);
  
  console.log(`📂 Extracting ZIP contents...`);
  
  // Extract all JSON/JSONL files
  const files = new Map<string, string>();
  
  for (const [filename, file] of Object.entries(zipContents.files)) {
    // Skip directories and non-JSON files
    if (file.dir) continue;
    if (!filename.endsWith('.json') && !filename.endsWith('.jsonl')) continue;
    
    // Extract file content as text
    const content = await file.async('text');
    
    // Store with just the filename (remove any directory paths)
    const basename = filename.split('/').pop() || filename;
    files.set(basename, content);
    
    console.log(`  ✓ Extracted: ${basename} (${Math.round(content.length / 1024)} KB)`);
  }
  
  return files;
}

/**
 * Parse JSONL content
 */
function parseJsonl(content: string): any[] {
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/**
 * Load dataset from ZIP file
 */
export async function loadDatasetFromZip(
  zipUrl: string,
  expectedFiles: string[] = [
    'conversations.jsonl',
    'properties.jsonl',
    'clusters.jsonl',
    'model_cluster_scores_df.jsonl',
    'cluster_scores_df.jsonl',
    'model_scores_df.jsonl',
    'metrics_insights.json'
  ]
): Promise<{
  conversations: any[];
  properties: any[];
  clusters: any[];
  metrics: {
    model_cluster_scores?: any[];
    cluster_scores?: any[];
    model_scores?: any[];
  };
  metrics_insights?: any;
}> {
  // Download and extract ZIP
  const files = await loadAndExtractZip(zipUrl);
  
  console.log(`📊 Available files in ZIP:`, Array.from(files.keys()));
  
  // Helper to load a file from extracted contents
  const loadFile = (filename: string, required: boolean = true): any[] | null => {
    const content = files.get(filename);
    
    if (!content) {
      if (required) {
        console.warn(`⚠️  Required file not found in ZIP: ${filename}`);
        console.warn(`   Available files:`, Array.from(files.keys()));
      }
      return null;
    }
    
    try {
      if (filename.endsWith('.jsonl')) {
        return parseJsonl(content);
      } else if (filename.endsWith('.json')) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`❌ Failed to parse ${filename}:`, error);
      if (required) throw error;
    }
    
    return null;
  };
  
  // Load required files
  const conversations = loadFile('conversations.jsonl', true) || [];
  const properties = loadFile('properties.jsonl', false) || [];
  const clusters = loadFile('clusters.jsonl', false) || [];
  
  // Load optional metrics files
  const modelClusterScores = loadFile('model_cluster_scores_df.jsonl', false);
  const clusterScores = loadFile('cluster_scores_df.jsonl', false);
  const modelScores = loadFile('model_scores_df.jsonl', false);
  const metricsInsights = loadFile('metrics_insights.json', false);
  
  const result = {
    conversations,
    properties,
    clusters,
    metrics: {
      model_cluster_scores: modelClusterScores || undefined,
      cluster_scores: clusterScores || undefined,
      model_scores: modelScores || undefined
    },
    metrics_insights: metricsInsights || undefined,
  };

  console.log(`✅ Loaded from ZIP:`, {
    conversations: result.conversations.length,
    properties: result.properties.length,
    clusters: result.clusters.length,
    metrics: {
      model_cluster_scores: result.metrics.model_cluster_scores?.length || 0,
      cluster_scores: result.metrics.cluster_scores?.length || 0,
      model_scores: result.metrics.model_scores?.length || 0
    },
    sampleConversation: result.conversations[0] ? {
      keys: Object.keys(result.conversations[0]),
      hasPrompt: 'prompt' in result.conversations[0],
      hasModel: 'model' in result.conversations[0] || 'model_a' in result.conversations[0],
      hasResponse: 'model_response' in result.conversations[0] || 'model_a_response' in result.conversations[0]
    } : 'No conversations'
  });

  return result;
}

/**
 * Check if a URL points to a ZIP file
 */
export function isZipUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.zip');
}




