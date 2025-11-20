import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  TableView as DataViewIcon,
  FindInPage as PropertyExtractionIcon,
  MenuBook as DocsIcon
} from '@mui/icons-material';
import { EXTERNAL_LINKS } from '../config';

export type SidebarSection = 'data' | 'extraction' | 'metrics';

interface PermanentIconSidebarProps {
  activeSection: SidebarSection;
  sidebarExpanded: boolean;
  onSectionChange: (section: SidebarSection) => void;
  highlightExtraction?: boolean;
}

interface IconButtonItemProps {
  icon: React.ReactNode;
  tooltip: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  customColor?: string;
  showActiveBackground?: boolean;
}

function IconButtonItem({ icon, tooltip, active, onClick, disabled = false, highlight = false, customColor, showActiveBackground = true }: IconButtonItemProps) {
  const shouldShowActiveBackground = active && showActiveBackground;
  
  return (
    <Tooltip title={tooltip} placement="right">
      <Box sx={{ mb: 1 }}>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: shouldShowActiveBackground ? 'primary.main' : 'transparent',
            color: shouldShowActiveBackground ? 'primary.contrastText' : customColor || (highlight ? 'warning.main' : 'text.secondary'),
            '&:hover': {
              backgroundColor: shouldShowActiveBackground ? 'primary.dark' : 'action.hover',
            },
            '&.Mui-disabled': {
              color: 'action.disabled',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {icon}
        </IconButton>
      </Box>
    </Tooltip>
  );
}

export default function PermanentIconSidebar({ activeSection, sidebarExpanded, onSectionChange, highlightExtraction = false }: PermanentIconSidebarProps) {
  return (
    <Box
      sx={{
        width: 60,
        height: (theme) => `calc(100vh - ${theme.mixins.toolbar.minHeight}px)`,
        backgroundColor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        position: 'fixed',
        left: 0,
        top: (theme) => theme.mixins.toolbar.minHeight, // Start below header
        zIndex: 1200,
      }}
    >
      <IconButtonItem
        icon={<DataViewIcon />}
        tooltip="Data - View model responses"
        active={activeSection === 'data'}
        onClick={() => onSectionChange('data')}
        customColor="#6B7280" // Muted blue-grey, almost grey
        showActiveBackground={sidebarExpanded} // Only show active background when sidebar is expanded
      />

      <IconButtonItem
        icon={<PropertyExtractionIcon />}
        tooltip="Extract interesting behaviors"
        active={activeSection === 'extraction'}
        onClick={() => onSectionChange('extraction')}
        highlight={activeSection !== 'extraction'}
        customColor="#4C6EF5" // Blue for primary button
        showActiveBackground={sidebarExpanded} // Only show active background when sidebar is expanded
      />

      {/* Spacer to push docs icon to bottom */}
      <Box sx={{ flex: 1, minHeight: 0 }} />

      <Tooltip title="Documentation - View StringSight documentation" placement="right">
        <Box sx={{ mb: 0 }}>
          <IconButton
            onClick={() => window.open(EXTERNAL_LINKS.DOCUMENTATION, '_blank', 'noopener,noreferrer')}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: 'transparent',
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <DocsIcon />
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}

