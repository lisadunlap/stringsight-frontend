import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { PromptsMetadata } from '../lib/api';

interface PromptsModalProps {
  open: boolean;
  onClose: () => void;
  prompts: PromptsMetadata | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prompts-tabpanel-${index}`}
      aria-labelledby={`prompts-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

function PromptDisplay({ title, content }: { title: string; content: string | undefined }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!content) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Not available
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
        <IconButton size="small" onClick={handleCopy} title="Copy to clipboard">
          {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        <Typography
          variant="body2"
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            margin: 0,
          }}
        >
          {content}
        </Typography>
      </Paper>
    </Box>
  );
}

export default function PromptsModal({ open, onClose, prompts }: PromptsModalProps) {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!prompts) {
    return null;
  }

  const hasDynamicPrompts = prompts.dynamic_prompts_used && prompts.verification_passed;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '70vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Generated Prompts
          </Typography>
          {hasDynamicPrompts ? (
            <Chip
              label="Dynamic"
              color="success"
              size="small"
              icon={<CheckCircleIcon />}
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Chip
              label="Static"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
          {prompts.dynamic_prompts_used && !prompts.verification_passed && (
            <Chip
              label="Verification Failed"
              color="warning"
              size="small"
              icon={<WarningIcon />}
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="prompt tabs">
            <Tab label="Discovery" />
            {hasDynamicPrompts && <Tab label="Clustering" />}
            {hasDynamicPrompts && <Tab label="Deduplication" />}
            {hasDynamicPrompts && <Tab label="Outlier" />}
            <Tab label="Metadata" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <PromptDisplay title="Discovery Prompt" content={prompts.discovery_prompt} />
        </TabPanel>

        {hasDynamicPrompts && (
          <>
            <TabPanel value={tabValue} index={1}>
              <PromptDisplay title="Clustering Prompt" content={prompts.clustering_prompt} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <PromptDisplay title="Deduplication Prompt" content={prompts.dedup_prompt} />
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <PromptDisplay title="Outlier Detection Prompt" content={prompts.outlier_prompt} />
            </TabPanel>

            <TabPanel value={tabValue} index={hasDynamicPrompts ? 4 : 1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {prompts.task_description_original && (
                  <PromptDisplay title="Original Task Description" content={prompts.task_description_original} />
                )}
                {prompts.expanded_task_description && (
                  <PromptDisplay title="Expanded Task Description" content={prompts.expanded_task_description} />
                )}
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Generation Details
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Dynamic Prompts Used:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {prompts.dynamic_prompts_used ? 'Yes' : 'No'}
                      </Typography>
                    </Box>
                    {prompts.verification_passed !== undefined && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Verification Passed:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {prompts.verification_passed ? 'Yes' : 'No'}
                        </Typography>
                      </Box>
                    )}
                    {prompts.reflection_attempts !== undefined && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Reflection Attempts:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {prompts.reflection_attempts}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Box>
            </TabPanel>
          </>
        )}

        {!hasDynamicPrompts && (
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {prompts.task_description_original && (
                <PromptDisplay title="Task Description" content={prompts.task_description_original} />
              )}
              <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Generation Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Dynamic Prompts Used:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {prompts.dynamic_prompts_used ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                  {prompts.verification_passed !== undefined && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Verification Passed:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {prompts.verification_passed ? 'Yes' : 'No'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          </TabPanel>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
