import React, { useRef } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getPrompts, getPromptText, extractSingle, extractJobStart, extractJobStatus, extractJobResult, extractJobCancel, getEmbeddingModels, runClustering } from '../../lib/api';

type Method = 'single_model' | 'side_by_side' | 'unknown';

interface PropertyExtractionPanelProps {
  method: Method;
  getSelectedRow: () => Record<string, any> | null;
  getAllRows: () => Record<string, any>[];
  getOperationalRows: () => any[];
  getPropertiesRows: () => any[];
  onPropertiesMerged: (props: any[]) => void;
  onSelectEvidence: (evidence: string[], targetModel?: string) => void;
  onBatchLoaded: (rows: any[]) => void;
  onBatchStart?: () => void;
  onBatchStatus?: (progress: number, state: string | null, stage?: 'extraction' | 'clustering', details?: string) => void;
  onBatchDone?: () => void;
  onOpenTrace?: (row: Record<string, any>) => void;
  onCloseTrace?: () => void;
  onClustersUpdated?: (data: {
    clusters: any[];
    total_conversations_by_model?: Record<string, number>;
    total_unique_conversations?: number;
    metrics?: {
      model_cluster_scores: any[];
      cluster_scores: any[];
      model_scores: any[];
    };
  }) => void;
  onNavigateToMetrics?: () => void;
}

export default function PropertyExtractionPanel({
  method,
  getSelectedRow,
  getAllRows,
  getOperationalRows,
  getPropertiesRows,
  onPropertiesMerged,
  onSelectEvidence,
  onBatchLoaded,
  onBatchStart,
  onBatchStatus,
  onBatchDone,
  onOpenTrace,
  onCloseTrace,
  onClustersUpdated,
  onNavigateToMetrics,
}: PropertyExtractionPanelProps) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [promptOptions, setPromptOptions] = React.useState<{ name: string; label: string; has_task_description: boolean; preview: string; default_task_description_single?: string | null; default_task_description_sbs?: string | null; }[]>([]);
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>(
    () => localStorage.getItem('stringsight.selectedPrompt') || 'default'
  );
  const [taskDescription, setTaskDescription] = React.useState<string>(
    () => localStorage.getItem('stringsight.taskDescription') || ''
  );
  const [userEdited, setUserEdited] = React.useState<boolean>(
    () => (localStorage.getItem('stringsight.taskDescriptionEdited') === 'true') || false
  );
  const [resolvedPrompt, setResolvedPrompt] = React.useState<string>('');

  const [modelName, setModelName] = React.useState<string>('gpt-4.1');
  const [temperature, setTemperature] = React.useState<number>(0.6);
  const [topP, setTopP] = React.useState<number>(0.95);
  const [maxTokens, setMaxTokens] = React.useState<number>(2048);
  const [maxWorkers, setMaxWorkers] = React.useState<number>(16);
  const [sampleSize, setSampleSize] = React.useState<number | null>(null);

  const [busy, setBusy] = React.useState<boolean>(false);
  const [lastExtractProps, setLastExtractProps] = React.useState<any[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [jobId, setJobId] = React.useState<string>('');
  const [jobProgress, setJobProgress] = React.useState<number>(0);
  const [jobState, setJobState] = React.useState<string | null>(null);

  // Clustering configuration
  const [minClusterSize, setMinClusterSize] = React.useState<number>(5);
  const [embeddingModel, setEmbeddingModel] = React.useState<string>('openai/text-embedding-3-small');
  const [embeddingModels, setEmbeddingModels] = React.useState<string[]>([]);
  const [groupBy, setGroupBy] = React.useState<'none'|'category'|'behavior_type'>('behavior_type');
  const [summarizationModel, setSummarizationModel] = React.useState<string>('gpt-4.1');
  const [matchingModel, setMatchingModel] = React.useState<string>('gpt-4.1-mini');
  const [clusteringBusy, setClusteringBusy] = React.useState<boolean>(false);
  const [currentStage, setCurrentStage] = React.useState<'extraction' | 'clustering' | null>(null);

  const selectedPromptMeta = promptOptions.find(p => p.name === selectedPrompt);
  const canTaskDescribe = selectedPromptMeta?.has_task_description || false;

  // Load prompts and embedding models on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getPrompts();
        const allowed = new Set(['default', 'agent']);
        const filtered = (res.prompts || []).filter((p: any) => allowed.has(p.name));
        if (mounted) setPromptOptions(filtered);
      } catch (e: any) {
        if (mounted) setErrorMsg(`Failed to load prompts: ${String(e?.message || e)}`);
      }

      // Load embedding models for clustering
      try {
        const embRes = await getEmbeddingModels();
        if (mounted) setEmbeddingModels(embRes.models || []);
        if (mounted && embRes.models && embRes.models.length > 0) setEmbeddingModel(embRes.models[0]);
      } catch (_) {
        // Ignore; keep default
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When promptOptions load or selectedPrompt changes, prefill task description with default if supported and user hasn't edited.
  React.useEffect(() => {
    if (!selectedPromptMeta) return;
    // Persist selected prompt
    localStorage.setItem('stringsight.selectedPrompt', selectedPrompt);
    // If prompt supports task description
    if (selectedPromptMeta.has_task_description) {
      const defaultDesc = method === 'side_by_side' ? (selectedPromptMeta.default_task_description_sbs || '') : (selectedPromptMeta.default_task_description_single || '');
      if (!userEdited) {
        setTaskDescription(defaultDesc);
        localStorage.setItem('stringsight.taskDescription', defaultDesc);
        localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
      }
    } else {
      // Clear task description for prompts that don't support it
      setTaskDescription('');
      localStorage.setItem('stringsight.taskDescription', '');
      localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromptMeta?.name, selectedPromptMeta?.has_task_description]);

  // Resolve prompt text when selection changes
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const effectiveTaskDesc = canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined;
        const methodParam = method === 'unknown' ? undefined : method;
        const res = await getPromptText(selectedPrompt, effectiveTaskDesc, methodParam);
        if (mounted) setResolvedPrompt(res.text);
      } catch (e: any) {
        if (mounted) {
          setResolvedPrompt('');
          setErrorMsg(`Failed to load prompt '${selectedPrompt}': ${String(e?.message || e)}`);
        }
      }
    })();
    return () => { mounted = false; };
  }, [selectedPrompt, canTaskDescribe, taskDescription]);

  // Highlight task description inside resolved prompt (visual only)
  const highlightedResolvedPrompt = React.useMemo(() => {
    const text = resolvedPrompt || '';
    const needle = canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription.trim() : '';
    if (!needle) return [text];
    const parts = text.split(needle);
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, idx) => {
      nodes.push(part);
      if (idx < parts.length - 1) {
        nodes.push(
          <span key={`hl-${idx}`} style={{ color: '#1D4ED8', fontWeight: 600 }}>{needle}</span>
        );
      }
    });
    return nodes;
  }, [resolvedPrompt, canTaskDescribe, taskDescription]);

  async function runExtractSingle() {
    const row = getSelectedRow();
    const methodValid = method === 'single_model' || method === 'side_by_side';
    console.log('[PropertyExtraction] runExtractSingle called', { row, methodValid, method });
    if (!row || !methodValid) return;
    setBusy(true);
    try {
      setErrorMsg(null);
      const body: any = {
        row,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
      };
      console.log('[PropertyExtraction] Calling extractSingle with body:', body);
      const res = await extractSingle({ ...body, return_debug: true });
      console.log('[PropertyExtraction] extractSingle response:', res);
      onPropertiesMerged(res.properties || []);
      setLastExtractProps(res.properties || []);
      
      // Open the trace viewer to show the selected row
      if (onOpenTrace && row) {
        onOpenTrace(row);
      }
      
      // Auto-scroll to results section after extraction completes
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 300); // Small delay to ensure results are rendered
      
      if ((res.failures || []).length > 0) {
        setErrorMsg(`Parsing issues detected (${res.failures.length}). Try a different prompt or check JSON format.`);
      }
    } catch (e: any) {
      console.error('[PropertyExtraction] Error in runExtractSingle:', e);
      setErrorMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function runExtractBatch() {
    const rows = getAllRows();
    const methodValid = method === 'single_model' || method === 'side_by_side';
    if (!rows || rows.length === 0 || !methodValid) return;

    // Close the trace viewer to focus on batch progress
    onCloseTrace?.();

    setBusy(true);
    setCurrentStage('extraction');
    onBatchStart?.();

    let extractedProperties: any[] = [];

    try {
      setErrorMsg(null);
      setJobProgress(0);
      setJobState('queued');

      // STAGE 1: Property Extraction
      onBatchStatus?.(0, 'queued', 'extraction', 'Starting property extraction...');

      const startRes = await extractJobStart({
        rows,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
        sample_size: sampleSize || undefined,
      });
      setJobId(startRes.job_id);

      await new Promise<void>((resolve, reject) => {
        const t = setInterval(async () => {
          try {
            const s = await extractJobStatus(startRes.job_id);
            setJobState(s.state);
            setJobProgress(s.progress || 0);
            onBatchStatus?.(s.progress || 0, s.state, 'extraction', 'Extracting properties...');
            if (s.state === 'done') {
              clearInterval(t);
              const r = await extractJobResult(startRes.job_id);
              extractedProperties = r.properties || [];
              (onBatchLoaded as any)?.(extractedProperties);
              resolve();
            } else if (s.state === 'cancelled') {
              clearInterval(t);
              const r = await extractJobResult(startRes.job_id);
              extractedProperties = r.properties || [];
              (onBatchLoaded as any)?.(extractedProperties);
              setErrorMsg(`Job cancelled. Retrieved ${extractedProperties.length} partial results.`);
              resolve();
            } else if (s.state === 'error') {
              clearInterval(t);
              reject(new Error(s.error || 'Job error'));
            }
          } catch (e) {
            clearInterval(t);
            reject(e);
          }
        }, 1000);
      });

      setBusy(false);
      setCurrentStage(null);

      // Small delay to let properties render in the UI
      await new Promise(resolve => setTimeout(resolve, 500));

      // STAGE 2: Clustering (automatically run after extraction with the extracted properties)
      if (extractedProperties.length > 0) {
        console.log('🎯 Starting clustering with', extractedProperties.length, 'extracted properties');
        await runClusteringWithProperties(extractedProperties);
        console.log('✅ Clustering completed successfully');
      } else {
        console.warn('⚠️ No properties extracted, skipping clustering');
      }

      onBatchDone?.();
    } catch (error) {
      console.error('Batch extraction failed:', error);
      setErrorMsg(String(error));
      setBusy(false);
      setCurrentStage(null);
    }
  }

  async function handleCancelJob() {
    if (!jobId) return;
    try {
      await extractJobCancel(jobId);
      setJobState('cancelled');
    } catch (e: any) {
      setErrorMsg(`Failed to cancel: ${String(e?.message || e)}`);
    }
  }

  async function runClusteringWithProperties(extractedProperties?: any[]) {
    const operationalRows = getOperationalRows();
    const properties = extractedProperties || getPropertiesRows();

    if (properties.length === 0) {
      console.warn('No properties available for clustering');
      return;
    }

    setClusteringBusy(true);
    setCurrentStage('clustering');

    try {
      console.log('🔍 Starting clustering with properties:', properties.length);
      console.log('🔍 Sample property:', properties[0]);
      console.log('🔍 Operational rows count:', operationalRows.length);

      // Determine which properties to cluster based on groupBy
      const propertiesToCluster = properties.map((prop: any) => {
        const groupKey = groupBy && groupBy !== 'none' ? prop[groupBy] : undefined;
        return groupKey ? `${groupKey}: ${prop.property_description || ''}` : prop.property_description || '';
      });

      onBatchStatus?.(0, 'clustering', 'clustering', `Clustering ${properties.length} properties...`);

      const scoreColumns = operationalRows[0] ? Object.keys(operationalRows[0]).filter(k => k.startsWith('score_')) : [];

      const body = {
        operationalRows,
        properties,
        params: { minClusterSize, embeddingModel, groupBy, summarizationModel, matchingModel },
        score_columns: scoreColumns.length > 0 ? scoreColumns : undefined,
      };

      console.log('🔍 Clustering request body:', {
        operationalRowsCount: body.operationalRows.length,
        propertiesCount: body.properties.length,
        params: body.params,
        score_columns: body.score_columns
      });

      const res = await runClustering(body as any);
      console.log('🔵 Clustering response:', res);
      console.log('🔵 Response type:', typeof res);
      console.log('🔵 Response keys:', res ? Object.keys(res) : 'null/undefined');

      if (!res) {
        throw new Error('Clustering API returned undefined response');
      }

      if (onClustersUpdated) {
        onClustersUpdated(res);
      }

      // Navigate to clusters tab after clustering completes
      if (onNavigateToMetrics) {
        console.log('📊 Navigating to Clusters tab');
        onNavigateToMetrics();
      } else {
        console.warn('⚠️ onNavigateToMetrics callback not provided');
      }

      onBatchStatus?.(1, 'done', 'clustering', 'Clustering complete');
    } catch (error) {
      console.error('Clustering failed:', error);
      setErrorMsg(`Clustering failed: ${String(error)}`);
      onBatchStatus?.(0, 'error', 'clustering', `Clustering failed: ${String(error)}`);
    } finally {
      setClusteringBusy(false);
      setCurrentStage(null);
    }
  }

  const methodValid = method === 'single_model' || method === 'side_by_side';

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: 'warning.main', mb: 1, textAlign: 'center', fontWeight: 500 }}>
        Extract interesting properties from your traces. Click 'Extract on Row 0' to see an example.
      </Typography>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Extraction Prompt
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            size="small"
            options={promptOptions.map(p => p.name)}
            value={selectedPrompt}
            onChange={(_, v) => {
              if (v) {
                setSelectedPrompt(v);
                localStorage.setItem('stringsight.selectedPrompt', v);
                // Reset edited flag on prompt change
                setUserEdited(false);
                localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
              }
            }}
            renderInput={(params) => <TextField {...params} label="Prompt" />}
          />
          
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {promptOptions.length} prompts available
          </Typography>
          
          {canTaskDescribe && (
            <Stack spacing={1}>
              <TextField 
                label="Task description" 
                value={taskDescription} 
                onChange={(e) => {
                  const val = e.target.value;
                  setTaskDescription(val);
                  setUserEdited(true);
                  localStorage.setItem('stringsight.taskDescription', val);
                  localStorage.setItem('stringsight.taskDescriptionEdited', 'true');
                }} 
                minRows={4}
                maxRows={9}
                multiline 
                sx={{
                  '& .MuiInputBase-root': {
                    overflow: 'auto',
                    fontSize: '0.9rem',
                  },
                  '& .MuiInputLabel-root': {
                    backgroundColor: 'background.paper',
                    px: 0.5,
                  }
                }}
              />
              <Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    const def = method === 'side_by_side' ? (selectedPromptMeta?.default_task_description_sbs || '') : (selectedPromptMeta?.default_task_description_single || '');
                    setTaskDescription(def);
                    setUserEdited(false);
                    localStorage.setItem('stringsight.taskDescription', def);
                    localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
                  }}
                >
                  Reset to default
                </Button>
              </Box>
            </Stack>
          )}

          {/* Resolved system prompt moved to Advanced accordion */}
        </Stack>
      </Box>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Advanced (LLM settings)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField 
              size="small" 
              label="Property Annotator" 
              value={modelName} 
              onChange={(e) => setModelName(e.target.value)} 
            />
            <TextField 
              size="small" 
              label="Sample size (batch only)" 
              type="number" 
              value={sampleSize || ''} 
              onChange={(e) => setSampleSize(e.target.value ? Number(e.target.value) : null)} 
              placeholder="Leave empty for all prompts"
              helperText={sampleSize ? `Will sample ${sampleSize} prompts total` : 'Process all prompts'}
            />
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Full system prompt</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ 
                  p: 2, 
                  border: '1px dashed', 
                  borderColor: 'divider', 
                  borderRadius: 1, 
                  backgroundColor: 'background.default' 
                }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Resolved system prompt {canTaskDescribe ? '(task description highlighted in blue)' : ''}
                  </Typography>
                  <Box sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: '#FFFFFF',
                    maxHeight: 280,
                    overflow: 'auto',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}>
                    {resolvedPrompt ? highlightedResolvedPrompt : 'Loading prompt…'}
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Clustering Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              After extraction, properties will be automatically clustered and metrics computed.
            </Typography>

            <TextField
              size="small"
              label="Min cluster size"
              type="number"
              value={minClusterSize}
              onChange={(e) => setMinClusterSize(Number(e.target.value))}
              inputProps={{ min: 1, max: 100 }}
              helperText="Minimum number of properties required to form a cluster"
            />

            <FormControl size="small">
              <InputLabel id="embedding-model-label">Embedding model</InputLabel>
              <Select
                labelId="embedding-model-label"
                value={embeddingModel}
                label="Embedding model"
                onChange={(e) => setEmbeddingModel(String(e.target.value))}
              >
                {(embeddingModels.length ? embeddingModels : [embeddingModel]).map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
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

            <TextField
              size="small"
              label="Summarization model"
              value={summarizationModel}
              onChange={(e) => setSummarizationModel(e.target.value)}
              helperText="Model used for cluster label summarization"
            />

            <TextField
              size="small"
              label="Matching model"
              value={matchingModel}
              onChange={(e) => setMatchingModel(e.target.value)}
              helperText="Model used for cluster/property matching"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* View Selected Response Button */}
      <Button
        variant="outlined"
        onClick={() => {
          const row = getSelectedRow();
          if (onOpenTrace && row) {
            onOpenTrace(row);
          }
        }}
        disabled={!getSelectedRow()}
        fullWidth
        sx={{ mb: 2 }}
      >
        {(() => {
          const row = getSelectedRow();
          if (!row) return 'No Response Selected';
          const index = (row as any)?.__index;
          return index !== undefined ? `View Response (Row ${index})` : 'View Selected Response';
        })()}
      </Button>

      {(busy || clusteringBusy) && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.5 }}>
            {currentStage === 'extraction' && jobState
              ? `Extracting properties: ${jobState} • ${Math.round((jobProgress||0)*100)}%`
              : currentStage === 'clustering'
              ? `Clustering properties...`
              : 'Processing...'}
          </Typography>
          {/* Indeterminate until first progress update (> 0), then determinate */}
          <LinearProgress
            variant={(jobProgress||0) > 0 && currentStage === 'extraction' ? 'determinate' : 'indeterminate'}
            value={(jobProgress||0)*100}
          />
          {/* Cancel button for batch jobs */}
          {jobId && jobState && currentStage === 'extraction' && !['done', 'error', 'cancelled'].includes(jobState) && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={handleCancelJob}
              sx={{ mt: 1, width: '100%' }}
            >
              Cancel Extraction
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <Button
            variant="contained"
            onClick={runExtractSingle}
            disabled={busy || clusteringBusy || !methodValid || !getSelectedRow()}
            sx={{ width: '100%' }}
          >
            {(() => {
              const row = getSelectedRow();
              if (!row) return 'Extract on selected';
              const index = (row as any)?.__index;
              return index !== undefined ? `Extract on Row ${index}` : 'Extract on selected';
            })()}
          </Button>
          <Button
            variant="outlined"
            onClick={runExtractBatch}
            disabled={busy || clusteringBusy || !methodValid}
            sx={{ width: '100%' }}
          >
            {sampleSize && sampleSize > 0
              ? `Run on sample (${sampleSize} prompts)`
              : `Run on all traces (${getAllRows().length})`}
          </Button>
        </Box>

      {errorMsg && (
        <Box sx={{ 
          p: 2, 
          border: '1px solid', 
          borderColor: 'error.main', 
          backgroundColor: 'error.light', 
          color: 'error.contrastText', 
          borderRadius: 1 
        }}>
          <Typography variant="body2">{errorMsg}</Typography>
        </Box>
      )}

      {lastExtractProps.length > 0 && (
        <Box ref={resultsRef} sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          borderRadius: 1
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Last extraction result
          </Typography>

          {method === 'side_by_side' ? (
            // Group properties by model for side-by-side
            (() => {
              const byModel = new Map<string, any[]>();
              lastExtractProps.forEach(p => {
                const modelName = (p as any).model || 'Unknown';
                if (!byModel.has(modelName)) byModel.set(modelName, []);
                byModel.get(modelName)!.push(p);
              });

              return (
                <Stack spacing={2}>
                  {Array.from(byModel.entries()).map(([modelName, props]) => (
                    <Box key={modelName}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'primary.main' }}>
                        {modelName}
                      </Typography>
                      <Box sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5 }}>
                        <Stack spacing={1}>
                          {props.map((p, i) => (
                            <Accordion
                              key={i}
                              disableGutters
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                backgroundColor: 'background.default'
                              }}
                              onChange={(_, expanded) => {
                                if (expanded) {
                                  const raw = p?.evidence;
                                  let list: string[] = [];
                                  if (Array.isArray(raw)) list = raw.map((s: any) => String(s || '').trim()).filter(Boolean);
                                  else if (typeof raw === 'string') {
                                    const trimmed = raw.trim();
                                    const parts = trimmed.split(/"\s*,\s*"|\n|,\s(?=[\w\d])/g).map(s => s.replace(/^"|"$/g, '').trim());
                                    list = parts.filter(Boolean);
                                  }
                                  onSelectEvidence(list, (p as any).model);
                                }
                              }}
                            >
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {p.property_description || `Property ${i + 1}`}
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 0.5, columnGap: 1 }}>
                                  {Object.entries(p)
                                    .filter(([k]) => !['raw_response', 'contains_errors', 'meta'].includes(k))
                                    .map(([k, v]) => (
                                    <React.Fragment key={k}>
                                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{k}</Typography>
                                      <Typography variant="caption" sx={{ color: 'text.primary' }}>
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </Typography>
                                    </React.Fragment>
                                  ))}
                                </Box>
                              </AccordionDetails>
                            </Accordion>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              );
            })()
          ) : (
            // Flat list for single model
            <Stack spacing={1}>
              {lastExtractProps.map((p, i) => (
                <Accordion
                  key={i}
                  disableGutters
                  sx={{
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.default'
                  }}
                  onChange={(_, expanded) => {
                    if (expanded) {
                      const raw = p?.evidence;
                      let list: string[] = [];
                      if (Array.isArray(raw)) list = raw.map((s: any) => String(s || '').trim()).filter(Boolean);
                      else if (typeof raw === 'string') {
                        const trimmed = raw.trim();
                        const parts = trimmed.split(/"\s*,\s*"|\n|,\s(?=[\w\d])/g).map(s => s.replace(/^"|"$/g, '').trim());
                        list = parts.filter(Boolean);
                      }
                      onSelectEvidence(list, (p as any).model);
                    }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {p.property_description || `Property ${i + 1}`}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 0.5, columnGap: 1 }}>
                      {Object.entries(p)
                        .filter(([k]) => !['raw_response', 'contains_errors', 'meta'].includes(k))
                        .map(([k, v]) => (
                        <React.Fragment key={k}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{k}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.primary' }}>
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </Typography>
                        </React.Fragment>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  );
}

