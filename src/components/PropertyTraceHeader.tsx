import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

interface PropertyTraceHeaderProps {
  selectedRow: any;
  selectedProperty: any;
  method: 'single_model' | 'side_by_side' | 'unknown';
  evidenceTargetModel?: string;
}

export default function PropertyTraceHeader({
  selectedRow,
  selectedProperty,
  method,
  evidenceTargetModel
}: PropertyTraceHeaderProps) {
  

  // Get metadata fields for 3-column layout
  const getMetadataFields = () => {
    if (!selectedProperty) return [];
    const metadataFields = ['category', 'behavior_type', 'unexpected_behavior'];
    return Object.entries(selectedProperty)
      .filter(([key]) => metadataFields.includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  };

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
        <Typography variant="caption" sx={{ color: '#334155', fontWeight: 500 }}>
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
    <Box sx={{ mb: 2 }}>
      {/* Property Information */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 600, mb: 1 }}>
          Property Information
        </Typography>

        {/* Property Description */}
        {selectedProperty?.property_description && (
          <Box sx={{ 
            backgroundColor: 'rgba(25, 118, 210, 0.1)', 
            borderRadius: 1, 
            p: 1, 
            mb: 1
          }}>
            <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'center', color: '#1565C0' }}>
              {selectedProperty.property_description}
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
      </Box>

      {/* Horizontal separator line */}
      <Box sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }} />
    </Box>
  );
}
