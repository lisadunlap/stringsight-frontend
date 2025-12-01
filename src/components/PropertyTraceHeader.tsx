import React from 'react';
import { Box, Typography, Stack, IconButton, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface PropertyTraceHeaderProps {
  selectedRow: any;
  selectedProperty: any;
  method: 'single_model' | 'side_by_side' | 'unknown';
  evidenceTargetModel?: string;
  onBack?: () => void;
  onDownloadPDF?: () => void;
  backLabel?: string;
}

export default function PropertyTraceHeader({
  selectedRow,
  selectedProperty,
  method,
  evidenceTargetModel,
  onBack,
  onDownloadPDF,
  backLabel = 'Back',
  disableNegativeMargin = false
}: PropertyTraceHeaderProps & { disableNegativeMargin?: boolean }) {


  // Get metadata fields for 3-column layout
  const getMetadataFields = () => {
    if (!selectedProperty) return [];
    const metadataFields = ['category', 'behavior_type', 'unexpected_behavior'];
    return Object.entries(selectedProperty)
      .filter(([key]) => metadataFields.includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

  // Show model field for side-by-side comparisons to clarify which model the property applies to
  const shouldShowModelField = method === 'side_by_side' && selectedProperty?.model;

  const getFullTextSections = () => {
    if (!selectedProperty) return [];
    const textFields = ['evidence', 'reason']; // Reordered: evidence first, then reason
    return Object.entries(selectedProperty)
      .filter(([key]) => textFields.some(f => key.toLowerCase().includes(f)))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

  // Format metadata field for 3-column layout
  const formatMetadataField = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;

    return (
      <Box key={key} sx={{ textAlign: 'left' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.5 }}>
          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Typography>
        <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>
          {String(value)}
        </Typography>
      </Box>
    );
  };

  const formatFullTextSection = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;

    let displayValue = '';

    // Handle arrays (like evidence)
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      displayValue = value.map(v => `"${v}"`).join('\n');
    } else {
      displayValue = String(value);
    }

    return (
      <Box key={key} sx={{ mb: 1, width: '100%' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', display: 'block', mb: 0.25 }}>
          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
        </Typography>
        <Typography variant="body2" sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#334155',
          fontStyle: key.toLowerCase().includes('evidence') ? 'italic' : 'normal'
        }}>
          {displayValue}
        </Typography>
      </Box>
    );
  };

  const metadataFields = getMetadataFields();
  const fullTextSections = getFullTextSections();

  return (
    <>
      {/* Sticky header and description - separate from scrollable content */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: '#FFFFFF',
        pb: 1,
        pt: 1,
        mx: disableNegativeMargin ? 0 : -2, // Extend to container edges (negative margin to offset container padding)
        px: 2, // Restore padding for content
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        mb: 2
      }}>
        {/* Back button and Download PDF button */}
        {(onBack || onDownloadPDF) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {onBack && (
              <>
                <IconButton onClick={onBack} size="small">
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="body2">{backLabel}</Typography>
              </>
            )}
            {onDownloadPDF && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={onDownloadPDF}
                sx={{ textTransform: 'none', ml: 'auto' }}
              >
                Download PDF
              </Button>
            )}
          </Box>
        )}


        {/* Property Description */}
        {selectedProperty?.property_description && (
          <Box sx={{
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderRadius: 1,
            p: 1,
            mb: 1,
            '& p': { margin: '4px 0' },
            '& code': { backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em' },
            '& pre': { backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' },
            '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '8px 0 4px 0', fontWeight: 600 },
            '& ul, & ol': { margin: '4px 0', paddingLeft: '20px' },
            '& blockquote': { borderLeft: '3px solid #ddd', paddingLeft: '12px', margin: '4px 0' },
            '& .katex': { fontSize: '1em' },
            '& .katex-display': { margin: '8px 0' },
          }}>
            <Typography variant="body2" component="div" sx={{ textAlign: 'center', color: '#1565C0' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  ),
                  p: ({ children }) => <span>{children}</span>,
                }}
              >
                {selectedProperty.property_description}
              </ReactMarkdown>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Rest of property information - scrollable */}
      <Box sx={{ mb: 2, px: disableNegativeMargin ? 2 : 0 }}>

        {/* Model Field - Show which model this property applies to (side-by-side only) */}
        {shouldShowModelField && (
          <Box sx={{
            mb: 1,
            p: 1,
            backgroundColor: 'rgba(76, 175, 80, 0.08)',
            borderRadius: 1
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#2E7D32', display: 'block', mb: 0.25 }}>
              Applies to Model:
            </Typography>
            <Typography variant="body2" sx={{ color: '#388E3C' }}>
              {selectedProperty.model}
            </Typography>
          </Box>
        )}

        {/* Full Text Sections (Evidence, Reason) */}
        {fullTextSections.map(([key, value]) => formatFullTextSection(key, value))}

        {/* Metadata Fields in 3-column layout */}
        {metadataFields.length > 0 && (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            mb: 1.5,
            mt: 1,
            p: 1.5,
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            {metadataFields.map(([key, value]) => formatMetadataField(key, value))}
          </Box>
        )}

        {/* Horizontal separator line */}
        <Box sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }} />
      </Box>
    </>
  );
}
