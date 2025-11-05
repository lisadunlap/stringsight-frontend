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
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CloseIcon from '@mui/icons-material/Close';
import { getPrompts, getPromptText, extractSingle, extractJobStart, extractJobStatus, extractJobResult, extractJobCancel, getEmbeddingModels, runClustering } from '../../lib/api';

type Method = 'single_model' | 'side_by_side' | 'unknown';

/**
 * Transform operationalRows to backend-expected format.
 * For side-by-side: converts model_a/model_b/score_a/score_b to arrays.
 * For single_model: renames fields to match backend expectations.
 */
function transformRowsForBackend(
  rows: Record<string, any>[],
  method: Method
): Record<string, any>[] {
  if (method === 'side_by_side') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt
      };

      // Convert model_a/model_b to model array
      if (row.model_a !== undefined && row.model_b !== undefined) {
        transformed.model = [row.model_a, row.model_b];
      } else if (row.model_a !== undefined) {
        transformed.model = [row.model_a];
      } else if (row.model_b !== undefined) {
        transformed.model = [row.model_b];
      }

      // Convert responses to array
      if (row.model_a_response !== undefined && row.model_b_response !== undefined) {
        transformed.responses = [row.model_a_response, row.model_b_response];
      } else if (row.model_a_response !== undefined) {
        transformed.responses = [row.model_a_response];
      } else if (row.model_b_response !== undefined) {
        transformed.responses = [row.model_b_response];
      }

      // Convert score_a/score_b to scores array
      if (row.score_a !== undefined && row.score_b !== undefined) {
        transformed.scores = [row.score_a, row.score_b];
      } else if (row.score_a !== undefined) {
        transformed.scores = [row.score_a];
      } else if (row.score_b !== undefined) {
        transformed.scores = [row.score_b];
      }

      return transformed;
    });
  } else if (method === 'single_model') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt,
        model: row.model
      };

      // Rename model_response to responses
      if (row.model_response !== undefined) {
        transformed.responses = row.model_response;
      }

      // Rename score to scores
      if (row.score !== undefined) {
        transformed.scores = row.score;
      }

      return transformed;
    });
  }

  // Return as-is for unknown method
  return rows;
}

// Demo mode fixed settings
const DEMO_MODE_SETTINGS = {
  modelName: 'gpt-4.1',
  embeddingModel: 'openai/text-embedding-3-small',
  summarizationModel: 'gpt-4.1-mini',
  matchingModel: 'gpt-4.1-mini',
  groupBy: 'behavior_type' as 'none' | 'category' | 'behavior_type',
};

interface PropertyExtractionPanelProps {
  method: Method;
  uploadedFileName?: string;
  resultsName?: string;
  onResultsNameChange?: (name: string) => void;
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
  demoSampleSize?: number; // When set, backend operations will be limited to this sample size
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
  uploadedFileName,
  resultsName: resultsNameProp,
  onResultsNameChange,
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
  demoSampleSize,
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

  // Demo mode detection
  const isDemoMode = !!demoSampleSize;

  // Use demo mode settings when applicable
  const [modelName, setModelName] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.modelName : 'gpt-4.1');
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
  const [embeddingModel, setEmbeddingModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : 'openai/text-embedding-3-small');
  const [embeddingModels, setEmbeddingModels] = React.useState<string[]>([]);
  const [groupBy, setGroupBy] = React.useState<'none'|'category'|'behavior_type'>(isDemoMode ? DEMO_MODE_SETTINGS.groupBy : 'behavior_type');
  const [summarizationModel, setSummarizationModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : 'gpt-4.1');
  const [matchingModel, setMatchingModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : 'gpt-4.1-mini');
  const [clusteringBusy, setClusteringBusy] = React.useState<boolean>(false);
  const [currentStage, setCurrentStage] = React.useState<'extraction' | 'clustering' | null>(null);

  // Full-screen prompt viewer
  const [promptFullscreen, setPromptFullscreen] = React.useState<boolean>(false);
  const [taskDescFullscreen, setTaskDescFullscreen] = React.useState<boolean>(false);

  const selectedPromptMeta = promptOptions.find(p => p.name === selectedPrompt);
  const canTaskDescribe = selectedPromptMeta?.has_task_description || false;

  // Generate output directory name with custom name (or filename) and timestamp
  const generateOutputDir = React.useCallback(() => {
    const baseName = resultsNameProp?.trim() || uploadedFileName || 'results';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: YYYY-MM-DDTHH-MM-SS
    return `${baseName}_${timestamp}`;
  }, [resultsNameProp, uploadedFileName]);

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
    if (!row || !methodValid) return;
    setBusy(true);
    try {
      setErrorMsg(null);
      const outputDir = generateOutputDir();
      const body: any = {
        row,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
        output_dir: outputDir,
      };
      const res = await extractSingle({ ...body, return_debug: true });
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

      const outputDir = generateOutputDir();

      const extractBody = {
        rows,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
        sample_size: demoSampleSize || sampleSize || undefined,
        output_dir: outputDir,
      };

      const startRes = await extractJobStart(extractBody);
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
        await runClusteringWithProperties(extractedProperties);
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
      // Don't set state here - let the polling loop detect the cancelled state from the server
      // to avoid race conditions where local state is overwritten by the next poll
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

    // Collapse examples/property details when clustering starts
    setLastExtractProps([]);

    setClusteringBusy(true);
    setCurrentStage('clustering');

    try {
      // Transform operationalRows to backend-expected format
      const transformedRows = transformRowsForBackend(operationalRows, method);

      console.log('🔍 Clustering:', properties.length, 'properties,', operationalRows.length, 'conversations');
      console.log('🔍 Properties model distribution:',
        properties.reduce((acc: any, p: any) => {
          const model = p.model || 'unknown';
          acc[model] = (acc[model] || 0) + 1;
          return acc;
        }, {})
      );

      // Determine which properties to cluster based on groupBy
      const propertiesToCluster = properties.map((prop: any) => {
        const groupKey = groupBy && groupBy !== 'none' ? prop[groupBy] : undefined;
        return groupKey ? `${groupKey}: ${prop.property_description || ''}` : prop.property_description || '';
      });

      onBatchStatus?.(0, 'clustering', 'clustering', `Clustering ${properties.length} properties...`);

      // Note: score_columns is NOT needed when sending nested dict format (score/scores: {metric: value})
      // The transformRowsForBackend() keeps scores as nested objects, so backend will auto-detect them.
      // Only send score_columns if scores are flattened into separate columns (e.g., reward: 0.8, accuracy: 0.9)
      
      console.log('🔍 Operational row sample:', {
        method,
        originalScore: operationalRows[0]?.score || operationalRows[0]?.score_a,
        transformedScore: transformedRows[0]?.scores,
        note: 'Scores are in nested dict format, no score_columns param needed'
      });

      // For side-by-side: create model-to-column mapping so backend knows which score belongs to which model
      let modelColumnMap: Record<string, string> | undefined;
      if (method === 'side_by_side' && operationalRows[0]) {
        const firstRow = operationalRows[0];
        modelColumnMap = {};

        // Map actual model names to their column identifiers
        if (firstRow.model_a) {
          modelColumnMap[firstRow.model_a] = 'model_a';
        }
        if (firstRow.model_b) {
          modelColumnMap[firstRow.model_b] = 'model_b';
        }
      }

      const outputDir = generateOutputDir();

      const body = {
        operationalRows: transformedRows,
        properties,
        params: {
          minClusterSize,
          embeddingModel: isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : embeddingModel,
          groupBy: isDemoMode ? DEMO_MODE_SETTINGS.groupBy : groupBy,
          summarizationModel: isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : summarizationModel,
          matchingModel: isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : matchingModel,
        },
        // score_columns omitted - scores are already in nested dict format (scores: {reward: 0})
        method,
        model_column_map: modelColumnMap,
        output_dir: outputDir,
        sample_size: demoSampleSize || sampleSize || undefined,
      };

      const res = await runClustering(body as any);

      // Log metrics if available
      if (res?.metrics?.model_scores) {
        console.log('🔵 Backend model_scores:',
          res.metrics.model_scores.map((s: any) => ({
            model: s.model,
            size: s.size,
            qualities: Object.keys(s).filter(k => k.startsWith('quality_') && !k.includes('_ci_')).length
          }))
        );
      } else {
        console.warn('⚠️ No model_scores in clustering response!');
      }

      if (!res) {
        throw new Error('Clustering API returned undefined response');
      }

      if (onClustersUpdated) {
        onClustersUpdated(res);
      }

      // Navigate to clusters tab after clustering completes
      if (onNavigateToMetrics) {
        onNavigateToMetrics();
      }

      onBatchStatus?.(1, 'done', 'clustering', 'Clustering complete');
    } catch (error) {
      console.error('Clustering failed:', error);
      const errorMessage = String(error);
      // Provide more helpful messages for network/timeout errors
      let userMessage = errorMessage;
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('timeout')) {
        userMessage = 'Network timeout: The clustering request timed out, but the backend may still be processing. ' +
          'Please wait a few minutes and check if results were saved. If you specified an output directory, ' +
          'you can try reloading the results from that location.';
      }
      setErrorMsg(`Clustering failed: ${userMessage}`);
      onBatchStatus?.(0, 'error', 'clustering', `Clustering failed: ${userMessage}`);
    } finally {
      setClusteringBusy(false);
      setCurrentStage(null);
    }
  }

  const methodValid = method === 'single_model' || method === 'side_by_side';

  return (
    <Stack spacing={1}>
      {/* Demo mode notification */}
      {demoSampleSize && (
        <Box sx={{ mb: 1, p: 1.5, border: '1px solid #3B82F6', background: '#EFF6FF', color: '#1E40AF', borderRadius: 1, fontSize: '0.875rem' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Demo mode active</Typography>
          <Typography variant="caption" component="div">
            • Backend operations limited to {demoSampleSize} rows
          </Typography>
          <Typography variant="caption" component="div">
            • Models fixed: {DEMO_MODE_SETTINGS.modelName}
          </Typography>
          <Typography variant="caption" component="div">
            • Clustering: {DEMO_MODE_SETTINGS.groupBy} grouping
          </Typography>
        </Box>
      )}

      <Typography variant="body2" sx={{ color: 'warning.main', mb: 1, textAlign: 'center', fontWeight: 500 }}>
        Extract interesting properties from your traces. Click 'Extract on Row 0' to see an example.
      </Typography>
      
      {/* View Selected Response Button */}
      <Button
        variant="outlined"
        onClick={() => {
          const row = getSelectedRow();
          if (onOpenTrace && row) {
            onOpenTrace(row);
          }
        }}
        disabled={!getSelectedRow() || !onOpenTrace}
        fullWidth
        sx={{ mb: 1 }}
      >
        {(() => {
          const row = getSelectedRow();
          if (!row) return 'No Response Selected';
          const index = (row as any)?.__index;
          return index !== undefined ? `View Response (Row ${index})` : 'View Selected Response';
        })()}
      </Button>
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
            renderInput={(params) => <TextField {...params} label="Task Type" />}
          />
          
          {/* <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {promptOptions.length} prompts available
          </Typography> */}
          
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 0.5, ml: -1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setTaskDescFullscreen(true)}
                        edge="end"
                        title="Expand to full screen"
                        sx={{ p: 0.5 }}
                      >
                        <FullscreenIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
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
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ minHeight: 'auto', py: 0.25, '& .MuiAccordionSummary-content': { margin: '4px 0' } }}
        >
          <Typography variant="subtitle2">Advanced settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* LLM Settings Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                LLM Settings
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Property Annotator"
                  value={isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={isDemoMode}
                  helperText={isDemoMode ? 'Fixed in demo mode' : undefined}
                />
                <TextField
                  size="small"
                  label="Sample size"
                  type="number"
                  value={sampleSize || ''}
                  onChange={(e) => setSampleSize(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Leave empty for all prompts"
                  helperText={sampleSize ? `Will sample ${sampleSize} prompts total` : 'Process all prompts'}
                />
                <TextField
                  size="small"
                  label="Results folder name"
                  value={resultsNameProp || ''}
                  onChange={(e) => onResultsNameChange?.(e.target.value)}
                  placeholder="Auto-generated from filename"
                  helperText={resultsNameProp ? `Results will be saved to: ${resultsNameProp}_[timestamp]` : 'Defaults to uploaded filename'}
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
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Resolved system prompt {canTaskDescribe ? '(task description highlighted in blue)' : ''}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setPromptFullscreen(true)}
                          sx={{ ml: 1 }}
                          title="Expand to full screen"
                        >
                          <FullscreenIcon fontSize="small" />
                        </IconButton>
                      </Box>
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
            </Box>

            {/* Clustering Settings Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Clustering Settings
              </Typography>
              <Stack spacing={1.5}>
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

                <FormControl size="small" disabled={isDemoMode}>
                  <InputLabel id="embedding-model-label">Embedding model</InputLabel>
                  <Select
                    labelId="embedding-model-label"
                    value={isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : embeddingModel}
                    label="Embedding model"
                    onChange={(e) => setEmbeddingModel(String(e.target.value))}
                  >
                    {(embeddingModels.length ? embeddingModels : [embeddingModel]).map(m => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                  {isDemoMode && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Fixed in demo mode
                    </Typography>
                  )}
                </FormControl>

                <FormControl size="small" disabled={isDemoMode}>
                  <InputLabel id="group-by-label">Group by</InputLabel>
                  <Select
                    labelId="group-by-label"
                    value={isDemoMode ? DEMO_MODE_SETTINGS.groupBy : groupBy}
                    label="Group by"
                    onChange={(e) => setGroupBy(e.target.value as any)}
                  >
                    <MenuItem value={'none'}>None</MenuItem>
                    <MenuItem value={'category'}>category</MenuItem>
                    <MenuItem value={'behavior_type'}>behavior_type</MenuItem>
                  </Select>
                  {isDemoMode && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Fixed in demo mode
                    </Typography>
                  )}
                </FormControl>

                <TextField
                  size="small"
                  label="Summarization model"
                  value={isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : summarizationModel}
                  onChange={(e) => setSummarizationModel(e.target.value)}
                  disabled={isDemoMode}
                  helperText={isDemoMode ? 'Fixed in demo mode' : 'Model used for cluster label summarization'}
                />

                <TextField
                  size="small"
                  label="Matching model"
                  value={isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : matchingModel}
                  onChange={(e) => setMatchingModel(e.target.value)}
                  disabled={isDemoMode}
                  helperText={isDemoMode ? 'Fixed in demo mode' : 'Model used for cluster/property matching'}
                />
              </Stack>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

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
          {/* Cancel button for batch jobs - temporarily removed */}
          {/* {jobId && jobState && currentStage === 'extraction' && !['done', 'error', 'cancelled'].includes(jobState) && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={handleCancelJob}
              sx={{ mt: 1, width: '100%' }}
            >
              Cancel Extraction
            </Button>
          )} */}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', mt: 3 }}>
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
            Properties extracted
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
                                <Stack spacing={1}>
                                  {(() => {
                                    const fieldOrder = ['model', 'property_description', 'evidence', 'behavior_type', 'category', 'reason', 'unexpected_behavior', 'question_id'];
                                    const orderedFields = fieldOrder.filter(key => key in p);
                                    const remainingFields = Object.entries(p)
                                      .filter(([k]) => !['raw_response', 'contains_errors', 'meta', 'id'].includes(k) && !fieldOrder.includes(k));
                                    
                                    return [...orderedFields.map(key => [key, p[key]]), ...remainingFields];
                                  })().map(([k, v]) => (
                                    <Box key={k}>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                        {k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </Typography>
                                      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 0.5 }} />
                                      <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
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
                    <Stack spacing={1}>
                      {(() => {
                        const fieldOrder = ['model', 'property_description', 'evidence', 'behavior_type', 'category', 'reason', 'unexpected_behavior', 'question_id'];
                        const orderedFields = fieldOrder.filter(key => key in p);
                        const remainingFields = Object.entries(p)
                          .filter(([k]) => !['raw_response', 'contains_errors', 'meta', 'id'].includes(k) && !fieldOrder.includes(k));
                        
                        return [...orderedFields.map(key => [key, p[key]]), ...remainingFields];
                      })().map(([k, v]) => (
                        <Box key={k}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 0.5 }} />
                          <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Full-screen prompt dialog */}
      <Dialog
        open={promptFullscreen}
        onClose={() => setPromptFullscreen(false)}
        maxWidth={false}
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">Full System Prompt</Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setPromptFullscreen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Resolved system prompt {canTaskDescribe ? '(task description highlighted in blue)' : ''}
            </Typography>
          </Box>
          <Box sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: '#FFFFFF',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            minHeight: '100%',
          }}>
            {resolvedPrompt ? highlightedResolvedPrompt : 'Loading prompt…'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptFullscreen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Full-screen task description dialog */}
      <Dialog
        open={taskDescFullscreen}
        onClose={() => setTaskDescFullscreen(false)}
        maxWidth={false}
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">Task Description</Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setTaskDescFullscreen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Edit your task description for the extraction prompt
            </Typography>
          </Box>
          <TextField
            value={taskDescription}
            onChange={(e) => {
              const val = e.target.value;
              setTaskDescription(val);
              setUserEdited(true);
              localStorage.setItem('stringsight.taskDescription', val);
              localStorage.setItem('stringsight.taskDescriptionEdited', 'true');
            }}
            multiline
            fullWidth
            variant="outlined"
            autoFocus
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                fontSize: 14,
                lineHeight: 1.8,
                minHeight: '70vh',
                alignItems: 'flex-start',
              },
              '& .MuiInputBase-input': {
                minHeight: '70vh !important',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Button
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
          <Button onClick={() => setTaskDescFullscreen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

