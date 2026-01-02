/**
 * React hook for loading datasets from URL-based routing
 */

import { useState, useEffect } from 'react';
import { loadDataset, getDatasetNameFromUrl, listDatasets } from './datasetLoader';
import type { LoadedDataset, DatasetConfig } from './types';

export interface UseDatasetFromUrlResult {
  dataset: LoadedDataset | null;
  isLoading: boolean;
  error: Error | null;
  datasetName: string | null;
  availableDatasets: Array<{ name: string; config: DatasetConfig }>;
}

/**
 * Hook to load dataset based on URL path
 * 
 * Usage:
 *   const { dataset, isLoading, error } = useDatasetFromUrl();
 * 
 * When user visits /taubench_airline, this will:
 *   1. Extract "taubench_airline" from URL
 *   2. Load datasets.yaml configuration
 *   3. Fetch files from S3/CDN
 *   4. Return loaded data
 */
export function useDatasetFromUrl(): UseDatasetFromUrlResult {
  const [dataset, setDataset] = useState<LoadedDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [availableDatasets, setAvailableDatasets] = useState<Array<{ name: string; config: DatasetConfig }>>([]);

  useEffect(() => {
    const loadFromUrl = async () => {
      try {
        // Extract dataset name from URL
        const name = getDatasetNameFromUrl();
        setDatasetName(name);
        
        // If no dataset in URL, just load available datasets list
        if (!name) {
          console.log('📋 No dataset in URL, loading available datasets...');
          const datasets = await listDatasets();
          setAvailableDatasets(datasets);
          return;
        }
        
        console.log(`🔄 Loading dataset from URL: ${name}`);
        setIsLoading(true);
        setError(null);
        
        // Load the dataset
        const loaded = await loadDataset(name);
        setDataset(loaded);
        
        // Also load available datasets for navigation
        const datasets = await listDatasets();
        setAvailableDatasets(datasets);
        
        console.log('✅ Dataset loaded successfully');
      } catch (err) {
        console.error('❌ Failed to load dataset:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        
        // Still try to load available datasets on error
        try {
          const datasets = await listDatasets();
          setAvailableDatasets(datasets);
        } catch (listErr) {
          console.error('Failed to load available datasets:', listErr);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFromUrl();
  }, [window.location.pathname]); // Reload when URL changes

  return {
    dataset,
    isLoading,
    error,
    datasetName,
    availableDatasets,
  };
}

/**
 * Hook to manually load a specific dataset (not from URL)
 * 
 * Usage:
 *   const { loadDataset, dataset, isLoading, error } = useDatasetLoader();
 *   // Later: loadDataset('taubench_airline')
 */
export function useDatasetLoader() {
  const [dataset, setDataset] = useState<LoadedDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = async (datasetName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const loaded = await loadDataset(datasetName);
      setDataset(loaded);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loadDataset: load,
    dataset,
    isLoading,
    error,
  };
}


