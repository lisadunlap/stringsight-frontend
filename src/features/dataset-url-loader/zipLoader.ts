/**
 * ZIP file loader for datasets
 * Handles loading and extracting ZIP files from backend
 */

import JSZip from 'jszip';
import type { DatasetConfig, LoadedDataset, DatasetsYaml } from './types';

/**
 * Load and extract a ZIP file from URL
 * Optimized with parallel extraction and timing
 */
async function loadAndExtractZip(url: string): Promise<Map<string, string>> {
  const t0 = performance.now();
  console.log(`📦 Downloading ZIP from ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.statusText}`);
  }
  console.log(`⏱️  Download complete: ${Math.round(performance.now() - t0)}ms`);

  const t1 = performance.now();
  const blob = await response.blob();
  console.log(`⏱️  Blob conversion: ${Math.round(performance.now() - t1)}ms (${Math.round(blob.size / 1024 / 1024)} MB)`);

  const t2 = performance.now();
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(blob);
  console.log(`⏱️  ZIP decompression: ${Math.round(performance.now() - t2)}ms`);

  console.log(`📂 Extracting ZIP contents in parallel...`);

  // Collect all JSON/JSONL files for parallel extraction
  const filesToExtract: Array<{ filename: string; basename: string; file: any }> = [];

  for (const [filename, file] of Object.entries(zipContents.files)) {
    // Skip directories and non-JSON files
    if ((file as any).dir) continue;
    if (!filename.endsWith('.json') && !filename.endsWith('.jsonl')) continue;

    const basename = filename.split('/').pop() || filename;
    filesToExtract.push({ filename, basename, file });
  }

  // Extract all files in parallel
  const t3 = performance.now();
  const extractionPromises = filesToExtract.map(async ({ basename, file }) => {
    const t = performance.now();
    const content = await file.async('text');
    const sizeMB = (content.length / 1024 / 1024).toFixed(1);
    const timeMs = Math.round(performance.now() - t);
    console.log(`  ✓ Extracted: ${basename} (${sizeMB} MB in ${timeMs}ms)`);
    return { basename, content };
  });

  const extractedFiles = await Promise.all(extractionPromises);
  console.log(`⏱️  Parallel extraction: ${Math.round(performance.now() - t3)}ms`);

  // Build result map
  const files = new Map<string, string>();
  for (const { basename, content } of extractedFiles) {
    files.set(basename, content);
  }

  console.log(`⏱️  Total ZIP processing: ${Math.round(performance.now() - t0)}ms`);

  return files;
}

/**
 * Parse JSONL content with timing
 */
function parseJsonl(content: string, filename?: string): any[] {
  const t0 = performance.now();
  const lines = content.trim().split('\n').filter(line => line.trim());
  const result = lines.map(line => JSON.parse(line));
  const timeMs = Math.round(performance.now() - t0);
  const sizeMB = (content.length / 1024 / 1024).toFixed(1);

  if (filename) {
    console.log(`⏱️  Parsed ${filename}: ${result.length} rows, ${sizeMB} MB in ${timeMs}ms`);
  }

  return result;
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
    'model_scores_df.jsonl'
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
        return parseJsonl(content, filename);
      } else if (filename.endsWith('.json')) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`❌ Failed to parse ${filename}:`, error);
      if (required) throw error;
    }

    return null;
  };

  console.log(`🔍 Parsing dataset files...`);
  const tParse = performance.now();

  // Load required files
  const conversations = loadFile('conversations.jsonl', true) || [];
  const properties = loadFile('properties.jsonl', false) || [];
  const clusters = loadFile('clusters.jsonl', false) || [];

  // Load optional metrics files
  const modelClusterScores = loadFile('model_cluster_scores_df.jsonl', false);
  const clusterScores = loadFile('cluster_scores_df.jsonl', false);
  const modelScores = loadFile('model_scores_df.jsonl', false);

  console.log(`⏱️  Total parsing time: ${Math.round(performance.now() - tParse)}ms`);
  
  const result = {
    conversations,
    properties,
    clusters,
    metrics: {
      model_cluster_scores: modelClusterScores || undefined,
      cluster_scores: clusterScores || undefined,
      model_scores: modelScores || undefined
    }
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


