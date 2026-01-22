/**
 * Dataset configuration types
 */

export type DatasetCategory =
  | 'Customer Service & Dialog'
  | 'Software Engineering'
  | 'QA & Medical'
  | 'Experimental / Toy';

export interface DatasetConfig {
  /**
   * Category label used for grouping on the /results page.
   *
   * Expected values:
   * - "Customer Service & Dialog"
   * - "Software Engineering"
   * - "QA & Medical"
   * - "Experimental / Toy"
   */
  category: DatasetCategory;
  name: string;
  description: string;
  cdn_url: string;  // URL to dataset ZIP file (from /api/results/zip endpoint)
  files: string[];
  method: 'single_model' | 'side_by_side';
  created_at: string;
}

export interface DatasetsYaml {
  datasets: Record<string, DatasetConfig>;
}

export interface LoadedDataset {
  name: string;
  config: DatasetConfig;
  conversations: any[];
  properties: any[];
  clusters: any[];
  metrics: {
    model_cluster_scores?: any[];
    cluster_scores?: any[];
    model_scores?: any[];
  };
  total_conversations_by_model?: Record<string, number>;
  total_unique_conversations?: number;
}




