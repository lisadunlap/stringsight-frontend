import React from 'react';
import { Box, Typography, Button, Stack, Chip, Tooltip, IconButton, Fade } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { FormControl, InputLabel, Select, MenuItem, TextField, Checkbox, ListItemText, OutlinedInput } from '@mui/material';

interface ClustersTabProps {
  clusters: any[];
  totalConversationsByModel?: Record<string, number> | null;
  totalUniqueConversations?: number | null;
  onClusterClick: (cluster: any) => void;
  getPropertiesRows?: () => any[];
  onRequestRecompute?: (included_property_ids?: string[]) => void;
  externalSearchQuery?: string;
  modelClusterScores?: any[];  // Metrics from model_cluster_scores_df.jsonl
}

function formatPercent(p?: number): string {
  if (typeof p !== 'number' || !isFinite(p)) return '';
  return `${(p * 100).toFixed(1)}%`;
}

function ClustersTab({ clusters, totalConversationsByModel, totalUniqueConversations, onClusterClick, getPropertiesRows, onRequestRecompute, externalSearchQuery, modelClusterScores }: ClustersTabProps) {

  // Enrich clusters with metrics data at render time
  const enrichedClusters = React.useMemo(() => {
    if (!modelClusterScores || modelClusterScores.length === 0) {
      return clusters;
    }

    return clusters.map(cluster => {
      const clusterLabel = cluster.label || cluster.cluster_label || String(cluster.id);

      // Find all metrics rows for this cluster
      const clusterMetrics = modelClusterScores.filter((m: any) =>
        m.cluster === clusterLabel || String(m.cluster_id) === String(cluster.id)
      );

      // Build proportion_by_model, quality_by_model, and quality_delta_by_model
      const proportionByModel: Record<string, number> = {};
      const proportionCIByModel: Record<string, { lower: number; upper: number }> = {};
      const qualityByModel: Record<string, any> = {};
      const qualityDeltaByModel: Record<string, any> = {};
      const qualityDeltaCIByModel: Record<string, Record<string, { lower: number; upper: number }>> = {};
      let proportionOverall: number | undefined = undefined;

      clusterMetrics.forEach((m: any) => {
        const model = m.model;
        if (model) {
          proportionByModel[model] = m.proportion;

          // Capture proportion confidence intervals
          if (m.proportion_ci_lower !== undefined && m.proportion_ci_upper !== undefined) {
            proportionCIByModel[model] = {
              lower: m.proportion_ci_lower,
              upper: m.proportion_ci_upper
            };
          }

          // Capture overall proportion if available (should be same across models for a cluster)
          if (m.proportion_overall !== undefined && proportionOverall === undefined) {
            proportionOverall = m.proportion_overall;
          }

          // Extract quality scores and deltas
          const qualityScores: Record<string, number> = {};
          const qualityDeltas: Record<string, number> = {};
          const qualityDeltaCIs: Record<string, { lower: number; upper: number }> = {};

          Object.keys(m).forEach(key => {
            if (key.startsWith('quality_delta_')) {
              // Pattern: quality_delta_Helpfulness -> Helpfulness
              const metricName = key.replace('quality_delta_', '');
              if (!key.includes('_ci_') && !key.includes('_significant')) {
                qualityDeltas[metricName] = m[key];
                
                // Check for CI bounds
                const ciLowerKey = `quality_delta_${metricName}_ci_lower`;
                const ciUpperKey = `quality_delta_${metricName}_ci_upper`;
                if (m[ciLowerKey] !== undefined && m[ciUpperKey] !== undefined) {
                  qualityDeltaCIs[metricName] = {
                    lower: m[ciLowerKey],
                    upper: m[ciUpperKey]
                  };
                }
              }
            } else if (key.startsWith('quality_')) {
              // Pattern: quality_Helpfulness -> Helpfulness OR quality_helpfulness_delta (old format)
              if (key.endsWith('_delta')) {
                // Old format: quality_helpfulness_delta -> helpfulness
                const metricName = key.replace('quality_', '').replace('_delta', '');
                qualityDeltas[metricName] = m[key];
              } else if (!key.includes('_ci_') && !key.includes('_significant')) {
                // Base score: quality_Helpfulness -> Helpfulness
                const metricName = key.replace('quality_', '');
                qualityScores[metricName] = m[key];
              }
            }
          });

          qualityByModel[model] = qualityScores;
          qualityDeltaByModel[model] = qualityDeltas;
          if (Object.keys(qualityDeltaCIs).length > 0) {
            qualityDeltaCIByModel[model] = qualityDeltaCIs;
          }
        }
      });

      // Calculate unique conversation count from proportion_overall * totalUniqueConversations
      const clusterConversationCount = (proportionOverall !== undefined && totalUniqueConversations)
        ? Math.round(proportionOverall * totalUniqueConversations)
        : cluster.meta?.total_unique_conversations;

      return {
        ...cluster,
        meta: {
          ...cluster.meta,
          proportion_by_model: proportionByModel,
          proportion_ci_by_model: proportionCIByModel,
          quality_by_model: qualityByModel,
          quality_delta_by_model: qualityDeltaByModel,
          quality_delta_ci_by_model: qualityDeltaCIByModel,
          total_unique_conversations: clusterConversationCount,
          proportion_overall: proportionOverall ?? cluster.meta?.proportion_overall
        }
      };
    });
  }, [clusters, modelClusterScores]);

  // Smooth entrance animation on initial mount
  const animateOnMountRef = React.useRef(true);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      animateOnMountRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const [decimals, setDecimals] = React.useState<number>(3);
  const [search, setSearch] = React.useState<string>('');
  const [selectedModels, setSelectedModels] = React.useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<'freqAsc' | 'freqDesc' | 'qualAsc' | 'qualDesc'>('freqDesc');
  const debouncedApplyRef = React.useRef<number | null>(null);

  // Update search when externalSearchQuery changes
  React.useEffect(() => {
    if (externalSearchQuery !== undefined && externalSearchQuery !== search) {
      setSearch(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const allModels = React.useMemo<string[]>(() => {
    // Prefer stable model list from properties if available
    try {
      const props = typeof getPropertiesRows === 'function' ? (getPropertiesRows() || []) : [];
      const fromProps = new Set<string>();
      (props || []).forEach((p: any) => {
        const m = p?.model != null ? String(p.model) : '';
        if (m) fromProps.add(m);
      });
      if (fromProps.size > 0) return Array.from(fromProps).sort((a, b) => a.localeCompare(b));
    } catch (_) {}

    // Fallback to deriving from current clusters
    const s = new Set<string>();
    (enrichedClusters || []).forEach((c) => {
      const meta = (c && c.meta) || {};
      const byModel = (meta.proportion_by_model && Object.keys(meta.proportion_by_model)) || [];
      const qualityByModel = (meta.quality_by_model && Object.keys(meta.quality_by_model)) || [];
      [...byModel, ...qualityByModel].forEach((m) => { if (m) s.add(String(m)); });
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [enrichedClusters, getPropertiesRows]);

  const allGroups = React.useMemo<string[]>(() => {
    const s = new Set<string>();
    (enrichedClusters || []).forEach((c) => {
      const meta = (c && c.meta) || {};
      const g = meta.group;
      if (g != null && g !== '') s.add(String(g));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [enrichedClusters]);

  const propertiesById = React.useMemo<Map<string, any>>(() => {
    const map = new Map<string, any>();
    const props = typeof getPropertiesRows === 'function' ? getPropertiesRows() : [];
    (props || []).forEach((p: any) => {
      const id = p?.id != null ? String(p.id) : null;
      if (id) map.set(id, p);
    });
    return map;
  }, [getPropertiesRows]);

  const applyRecompute = React.useCallback(() => {
    if (!onRequestRecompute) return;
    const hasModelFilter = selectedModels.length > 0;
    const hasGroupFilter = selectedGroups.length > 0;
    if (!hasModelFilter && !hasGroupFilter) {
      onRequestRecompute(undefined);
      return;
    }
    const included = new Set<string>();
    (enrichedClusters || []).forEach((c) => {
      const meta = (c && c.meta) || {};
      if (hasGroupFilter) {
        const g = meta.group != null ? String(meta.group) : null;
        if (!g || !selectedGroups.includes(g)) return;
      }
      // Always derive from the cluster's property_ids (stable superset),
      // falling back to meta.property_items only if property_ids are missing.
      const idsFromCluster: string[] = Array.isArray((c as any).property_ids)
        ? (c as any).property_ids.map((pid: any) => (pid != null ? String(pid) : '')).filter(Boolean)
        : (Array.isArray((meta as any).property_items)
            ? (meta as any).property_items.map((it: any) => (it?.property_id != null ? String(it.property_id) : '')).filter(Boolean)
            : []);
      idsFromCluster.forEach((pid) => {
        if (!pid) return;
        if (hasModelFilter) {
          const prop = propertiesById.get(pid);
          const model = prop?.model != null ? String(prop.model) : null;
          if (model && selectedModels.includes(model)) included.add(pid);
        } else {
          included.add(pid);
        }
      });
    });
    onRequestRecompute(Array.from(included));
  }, [onRequestRecompute, selectedModels, selectedGroups, enrichedClusters, propertiesById]);

  const requestRecomputeDebounced = React.useCallback(() => {
    if (debouncedApplyRef.current) {
      window.clearTimeout(debouncedApplyRef.current);
      debouncedApplyRef.current = null;
    }
    debouncedApplyRef.current = window.setTimeout(() => {
      applyRecompute();
    }, 300);
  }, [applyRecompute]);

  const visibleClusters = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const hasSearch = query.length > 0;
    const hasModelFilter = selectedModels.length > 0;
    const hasGroupFilter = selectedGroups.length > 0;

    const avgQuality = (c: any): number => {
      const q = (c && c.meta && c.meta.quality) || {};
      const vals = Object.values(q).map((v: any) => Number(v)).filter((v) => Number.isFinite(v));
      if (!vals.length) return -Infinity; // ensure clusters without quality sink when sorting by quality
      const sum = vals.reduce((a, b) => a + b, 0);
      return sum / vals.length;
    };

    let list = (enrichedClusters || []).filter((c) => {
      const meta = (c && c.meta) || {};

      // search match: cluster label or any property description
      let matchesSearch = true;
      if (hasSearch) {
        const label = String(c.label || '').toLowerCase();
        const fromMetaItems: string[] = Array.isArray((meta as any).property_items)
          ? (meta as any).property_items.map((it: any) => String(it?.property_description || '').toLowerCase())
          : [];
        const fromDescriptions: string[] = Array.isArray(c.property_descriptions)
          ? c.property_descriptions.map((s: any) => String(s || '').toLowerCase())
          : [];
        matchesSearch = label.includes(query) || fromMetaItems.some((t) => t.includes(query)) || fromDescriptions.some((t) => t.includes(query));
      }

      if (!matchesSearch) return false;

      // model filter: require intersection with models present in cluster meta
      if (hasModelFilter) {
        const modelsInCluster = new Set<string>([
          ...Object.keys(meta.proportion_by_model || {}),
          ...Object.keys(meta.quality_by_model || {}),
        ].map((m) => String(m)));
        const intersects = selectedModels.some((m) => modelsInCluster.has(String(m)));
        if (!intersects) return false;
      }

      // group filter: cluster meta.group must be one of selected
      if (hasGroupFilter) {
        const g = meta.group != null ? String(meta.group) : null;
        if (!g || !selectedGroups.includes(g)) return false;
      }

      return true;
    });

    // sort
    switch (sortBy) {
      case 'qualAsc':
        list = [...list].sort((a, b) => avgQuality(a) - avgQuality(b));
        break;
      case 'qualDesc':
        list = [...list].sort((a, b) => avgQuality(b) - avgQuality(a));
        break;
      case 'freqAsc':
        list = [...list].sort((a, b) => (Number(a.size || 0) - Number(b.size || 0)));
        break;
      case 'freqDesc':
      default:
        list = [...list].sort((a, b) => (Number(b.size || 0) - Number(a.size || 0)));
        break;
    }
    return list;
  }, [enrichedClusters, search, selectedModels, selectedGroups, sortBy]);
  if (!clusters || clusters.length === 0) {
    return (
      <Box sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 0.5, background: '#FFFFFF' }}>
        <Typography variant="body1" color="text.secondary">No clusters yet. Run clustering from the sidebar.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 0.5, overflow: 'hidden', background: '#FFFFFF' }}>
      {/* Legend / helper text */}
      <Box sx={{ p: 1.5, background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: '#6B7280' }} />
          <Typography variant="caption" color="text.secondary">
            Overall proportion = share of all conversations in this cluster. Per-model proportion = share of that model's conversations in this cluster.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search clusters or properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="models-label">Models</InputLabel>
            <Select
              labelId="models-label"
              multiple
              value={selectedModels}
              onChange={(e) => {
                setSelectedModels(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]));
                requestRecomputeDebounced();
              }}
              input={<OutlinedInput label="Models" />}
              renderValue={(selected) => {
                const count = (selected as string[]).length;
                return count > 0 ? `${count} selected` : 'All';
              }}
              MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
            >
              {allModels.map((name) => (
                <MenuItem key={name} value={name}>
                  <Checkbox checked={selectedModels.indexOf(name) > -1} />
                  <ListItemText primary={name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={allGroups.length === 0}>
            <InputLabel id="groups-label">Group</InputLabel>
            <Select
              labelId="groups-label"
              multiple
              value={selectedGroups}
              onChange={(e) => {
                setSelectedGroups(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]));
                requestRecomputeDebounced();
              }}
              input={<OutlinedInput label="Group" />}
              renderValue={(selected) => {
                const count = (selected as string[]).length;
                return count > 0 ? `${count} selected` : 'All';
              }}
              MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
            >
              {allGroups.map((g) => (
                <MenuItem key={g} value={g}>
                  <Checkbox checked={selectedGroups.indexOf(g) > -1} />
                  <ListItemText primary={g} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="sortby-label">Sort By</InputLabel>
            <Select labelId="sortby-label" value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value as any)}>
              <MenuItem value={'freqAsc'}>Frequency ▲</MenuItem>
              <MenuItem value={'freqDesc'}>Frequency ▼</MenuItem>
              <MenuItem value={'qualAsc'}>Quality ▲</MenuItem>
              <MenuItem value={'qualDesc'}>Quality ▼</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="decimals-label">Decimals</InputLabel>
            <Select labelId="decimals-label" value={decimals} label="Decimals" onChange={(e) => setDecimals(Number(e.target.value))}>
              <MenuItem value={1}>1</MenuItem>
              <MenuItem value={2}>2</MenuItem>
              <MenuItem value={3}>3</MenuItem>
              <MenuItem value={4}>4</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>
      {(selectedModels.length > 0 || selectedGroups.length > 0 || (search.trim().length > 0)) && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', background: '#F9FAFB' }}>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Active filters:</Typography>
          {selectedModels.map((m) => (
            <Chip
              key={`model-${m}`}
              size="small"
              color="primary"
              variant="outlined"
              label={m}
              onDelete={() => { setSelectedModels((prev) => prev.filter((x) => x !== m)); requestRecomputeDebounced(); }}
            />
          ))}
          {selectedGroups.map((g) => {
            // Determine chip color and variant based on group name (same logic as main chips)
            let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' = 'secondary';
            let chipVariant: 'filled' | 'outlined' = 'outlined';
            let chipStyle = {};
            
            const groupLower = g.toLowerCase();
            if (groupLower === 'positive') {
              chipColor = 'success';
              chipVariant = 'filled';
            } else if (groupLower === 'negative (critical)') {
              chipColor = 'error';
              chipVariant = 'filled';
            } else if (groupLower === 'negative (non-critical)') {
              chipColor = 'warning';
              chipVariant = 'filled';
            } else if (groupLower === 'style') {
              chipVariant = 'filled';
              chipStyle = { 
                backgroundColor: '#9C27B0', 
                color: 'white',
                '&:hover': { backgroundColor: '#7B1FA2' }
              };
            }
            
            return (
              <Chip
                key={`group-${g}`}
                size="small"
                color={chipColor}
                variant={chipVariant}
                label={g}
                onDelete={() => { setSelectedGroups((prev) => prev.filter((x) => x !== g)); requestRecomputeDebounced(); }}
                sx={Object.keys(chipStyle).length > 0 ? chipStyle : undefined}
              />
            );
          })}
          {search.trim().length > 0 && (
            <Chip
              size="small"
              color="default"
              variant="outlined"
              label={`Search: ${search}`}
              onDelete={() => setSearch('')}
            />
          )}
          <Button size="small" variant="text" onClick={() => { setSelectedModels([]); setSelectedGroups([]); setSearch(''); requestRecomputeDebounced(); }}>Clear all</Button>
        </Box>
      )}
      {visibleClusters.map((c, idx) => {
        const meta = (c && c.meta) || {};
        const overallQuality: Record<string, number> = meta.quality || {};
        const overallQualityDelta: Record<string, number> = meta.quality_delta || {};
        const overallProp: number | undefined = meta.proportion_overall;
        const group: string | undefined = meta.group;
        const clusterUniqueConversations: number | undefined = meta.total_unique_conversations;

        const row = (
          <Box
            key={c.id ?? idx}
            onClick={() => onClusterClick(c)}
            sx={{
              p: 2,
              borderBottom: '1px solid #E5E7EB',
              cursor: 'pointer',
              transition: 'background 0.2s',
              '&:hover': {
                background: '#F9FAFB',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#111827' }}>
                {String(c.label || '')}
              </Typography>
              {/* Overall quality metrics */}
                  {overallQuality && Object.keys(overallQuality).length > 0 && (
                <Stack direction="column" spacing={0.25} sx={{ minWidth: 300, maxWidth: '40%', alignItems: 'flex-end' }}>
                        {Object.entries(overallQuality).map(([k, v]) => {
                          const d = overallQualityDelta && typeof overallQualityDelta[k] === 'number' ? overallQualityDelta[k] : undefined;
                          let deltaColor = '#6B7280';
                          if (typeof d === 'number') {
                      if (d > 0.02) deltaColor = '#16A34A';
                      else if (d < -0.02) deltaColor = '#DC2626';
                          }
                          return (
                      <Typography key={k} variant="body2" sx={{ color: '#334155', textAlign: 'right', fontSize: '0.875rem' }}>
                              {k}: {typeof v === 'number' ? v.toFixed(decimals) : String(v)}
                              {typeof d === 'number' && (
                                <Box component="span" sx={{ ml: 0.5, color: deltaColor }}>
                                  ({d >= 0 ? '+' : ''}{d.toFixed(decimals)})
                                </Box>
                              )}
                            </Typography>
                          );
                        })}
                      </Stack>
                  )}
                </Box>
            {/* Metadata row */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ color: '#6B7280', fontSize: 13 }}>
                      {(() => {
                        if (clusterUniqueConversations !== undefined && clusterUniqueConversations > 0) {
                          const propText = overallProp !== undefined ? ` (${formatPercent(overallProp)})` : '';
                          return `${clusterUniqueConversations.toLocaleString()} conversations${propText}`;
                        }
                        const clusterSize = c.size ?? 0;
                        return `${clusterSize.toLocaleString()} properties`;
                      })()}
                    </Box>
                  {group && (() => {
                    let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' = 'default';
                    let chipVariant: 'filled' | 'outlined' = 'outlined';
                    let chipStyle = {};
                    
                    const groupLower = group.toLowerCase();
                    if (groupLower === 'positive') {
                      chipColor = 'success';
                      chipVariant = 'filled';
                    } else if (groupLower === 'negative (critical)') {
                      chipColor = 'error';
                      chipVariant = 'filled';
                    } else if (groupLower === 'negative (non-critical)') {
                      chipColor = 'warning';
                      chipVariant = 'filled';
                    } else if (groupLower === 'style') {
                      chipVariant = 'filled';
                      chipStyle = { 
                        backgroundColor: '#9C27B0', 
                        color: 'white',
                        '&:hover': { backgroundColor: '#7B1FA2' }
                      };
                    }
                    
                    return (
                      <Chip 
                        size="small" 
                        color={chipColor} 
                        variant={chipVariant}
                        label={group}
                        sx={Object.keys(chipStyle).length > 0 ? chipStyle : undefined}
                      />
                    );
                  })()}
                </Stack>
              </Box>
        );

        if (animateOnMountRef.current && idx < 20) {
          return (
            <Fade in timeout={Math.min(900 + idx * 140, 2600)} key={`fade-${c.id ?? idx}`}>
              {row}
            </Fade>
          );
        }
        return row;
      })}
    </Box>
  );
}
export default React.memo(ClustersTab);
