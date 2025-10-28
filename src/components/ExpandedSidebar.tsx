import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft as CollapseIcon } from '@mui/icons-material';
import { type SidebarSection } from './PermanentIconSidebar';

interface ExpandedSidebarProps {
  activeSection: SidebarSection;
  expanded: boolean;
  onToggleExpanded: () => void;
  children: React.ReactNode;
}

const sectionTitles: Record<SidebarSection, string> = {
  data: 'Data Statistics',
  extraction: 'Property Extraction',
  metrics: 'Insights Dashboard'
};

export default function ExpandedSidebar({ 
  activeSection, 
  expanded, 
  onToggleExpanded, 
  children 
}: ExpandedSidebarProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: 60, // Start from the icon sidebar
        top: 64, // Start below header
        height: 'calc(100vh - 64px)',
        width: expanded ? 400 : 0, // Animate width
        backgroundColor: 'background.paper',
        borderRight: expanded ? '1px solid' : 'none',
        borderColor: 'divider',
        boxShadow: expanded ? 3 : 0,
        zIndex: 1200,
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1) 0ms, box-shadow 225ms cubic-bezier(0, 0, 0.2, 1) 0ms',
        overflow: 'hidden', // Hide content when width is 0
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 64,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {sectionTitles[activeSection]}
          </Typography>
          <IconButton
            aria-label="Collapse panel"
            onClick={onToggleExpanded}
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
            title="Collapse panel"
          >
            <CollapseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
