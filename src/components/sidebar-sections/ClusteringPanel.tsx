import React from 'react';
import { Box, Stack, Typography, TextField, Button, MenuItem, Select, FormControl, InputLabel, LinearProgress } from '@mui/material';
import { getEmbeddingModels, runClustering } from '../../lib/api';

interface ClusteringPanelProps {
  hasAnyProperties: boolean;
  getOperationalRows: () => any[];
  getPropertiesRows: () => any[];
  onClustersUpdated: (data: { 
    clusters: any[]; 
    total_conversations_by_model?: Record<string, number>;
    total_unique_conversations?: number;
    metrics?: {
      model_cluster_scores: any[];
      cluster_scores: any[];
      model_scores: any[];
    };
  }) => void;
}

export default function ClusteringPanel({ hasAnyProperties, getOperationalRows, getPropertiesRows, onClustersUpdated }: ClusteringPanelProps) {
  const [minClusterSize, setMinClusterSize] = React.useState<number>(5);
  const [embeddingModel, setEmbeddingModel] = React.useState<string>('openai/text-embedding-3-small');
  const [models, setModels] = React.useState<string[]>([]);
  const [groupBy, setGroupBy] = React.useState<'none'|'category'|'behavior_type'>('behavior_type');
  const [busy, setBusy] = React.useState<boolean>(false);
  // UI-only LLM configs for clustering labeling/matching (not sent to backend yet)
  const [summarizationModel, setSummarizationModel] = React.useState<string>('gpt-4.1');
  const [matchingModel, setMatchingModel] = React.useState<string>('gpt-4.1-mini');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getEmbeddingModels();
        if (!cancelled) setModels(res.models || []);
        if (!cancelled && res.models && res.models.length > 0) setEmbeddingModel(res.models[0]);
      } catch (_) {
        // Ignore; keep default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClusterProperties = async () => {
    if (!hasAnyProperties) return;

    setBusy(true);
    try {
      const operationalRows = getOperationalRows();
      const properties = getPropertiesRows();

      // Debug: check if operationalRows have score data
      console.log('🔍 Sending to backend:');
      console.log('  - operationalRows count:', operationalRows.length);
      console.log('  - properties count:', properties.length);
      console.log('  - Sample operational row:', operationalRows[0]);
      console.log('  - Sample row keys:', operationalRows[0] ? Object.keys(operationalRows[0]) : []);
      console.log('  - Sample row score:', operationalRows[0]?.score);
      console.log('  - Sample row score type:', typeof operationalRows[0]?.score);
      console.log('  - Sample row score_a:', operationalRows[0]?.score_a);
      console.log('  - Sample row score_b:', operationalRows[0]?.score_b);
      
      // Check if scores are nested objects or flat columns
      if (operationalRows[0]?.score && typeof operationalRows[0].score === 'object') {
        console.log('  - Score is nested object with keys:', Object.keys(operationalRows[0].score));
      }
      
      // Check for flattened score columns (e.g., score_helpfulness)
      // Backend needs to know which columns contain quality metrics
      const scoreColumns = operationalRows[0] ? Object.keys(operationalRows[0]).filter(k => k.startsWith('score_')) : [];
      console.log('  - Score-related columns found:', scoreColumns);

      const body = {
        operationalRows,
        properties,
        params: { minClusterSize, embeddingModel, groupBy, summarizationModel, matchingModel },
        score_columns: scoreColumns.length > 0 ? scoreColumns : undefined,
      };
      const res = await runClustering(body as any);
      console.log('🔵 Clustering response:', res);
      console.log('🔵 Metrics in response:', res.metrics);
      
      // Detailed metrics logging
      if (res.metrics?.model_cluster_scores) {
        console.log('🔵 model_cluster_scores sample:', res.metrics.model_cluster_scores[0]);
        console.log('🔵 model_cluster_scores columns:', res.metrics.model_cluster_scores[0] ? Object.keys(res.metrics.model_cluster_scores[0]) : []);
        console.log('🔵 Quality-related columns:', res.metrics.model_cluster_scores[0] 
          ? Object.keys(res.metrics.model_cluster_scores[0]).filter(k => k.includes('quality'))
          : []
        );
      } else {
        console.warn('⚠️ No model_cluster_scores in metrics response!');
      }
      
      onClustersUpdated(res);
    } catch (error) {
      console.error('Clustering failed:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Clustering Settings
        </Typography>
        
        {!hasAnyProperties && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'warning.light', 
            borderRadius: 1, 
            mb: 2,
            border: '1px solid',
            borderColor: 'warning.main'
          }}>
            <Typography variant="body2" color="warning.contrastText">
              No properties available for clustering. Run property extraction first.
            </Typography>
          </Box>
        )}
        
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Min cluster size"
            type="number"
            value={minClusterSize}
            onChange={(e) => setMinClusterSize(Number(e.target.value))}
            disabled={!hasAnyProperties}
            inputProps={{ min: 1, max: 100 }}
            helperText="Minimum number of properties required to form a cluster"
          />
          <FormControl size="small" disabled={!hasAnyProperties}>
            <InputLabel id="embedding-model-label">Embedding model</InputLabel>
            <Select
              labelId="embedding-model-label"
              value={embeddingModel}
              label="Embedding model"
              onChange={(e) => setEmbeddingModel(String(e.target.value))}
            >
              {(models.length ? models : [embeddingModel]).map(m => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" disabled={!hasAnyProperties}>
            <InputLabel id="group-by-label">Group by</InputLabel>
            <Select
              labelId="group-by-label"
              value={groupBy}
              label="Group by"
              onChange={(e) => setGroupBy(e.target.value as any)}
            >
              <MenuItem value={'none'}>None</MenuItem>
              <MenuItem value={'category'}>category</MenuItem>
              <MenuItem value={'behavior_type'}>behavior_type</MenuItem>
            </Select>
          </FormControl>

          {/* LLM configuration for cluster labeling/matching (UI-only for now) */}
          <TextField
            size="small"
            label="Summarization model"
            value={summarizationModel}
            onChange={(e) => setSummarizationModel(e.target.value)}
            disabled={!hasAnyProperties}
            helperText="Passed to backend for cluster label summarization"
          />
          <TextField
            size="small"
            label="Matching model"
            value={matchingModel}
            onChange={(e) => setMatchingModel(e.target.value)}
            disabled={!hasAnyProperties}
            helperText="Passed to backend for cluster/property matching"
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Actions
        </Typography>
        
        {busy && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.5 }}>
              Clustering properties...
            </Typography>
            <LinearProgress />
          </Box>
        )}
        
        <Stack spacing={1}>
          <Button
            variant="contained"
            onClick={handleClusterProperties}
            disabled={!hasAnyProperties || busy}
            fullWidth
          >
            {busy ? 'Clustering...' : 'Cluster Properties'}
          </Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Clustering will group similar properties together based on their semantic content. 
          This helps identify patterns and themes in your extracted properties.
        </Typography>
      </Box>

      
    </Stack>
  );
}

