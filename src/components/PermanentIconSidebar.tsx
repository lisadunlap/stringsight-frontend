import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  TableView as DataViewIcon,
  FindInPage as PropertyExtractionIcon,
  BubbleChart as ClustersIcon,
  Insights as InsightsIcon,
  ArrowDownward as ArrowDownIcon,
  MenuBook as DocsIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { EXTERNAL_LINKS } from '../config';

export type SidebarSection = 'data' | 'extraction' | 'clusters' | 'metrics';

interface PermanentIconSidebarProps {
  activeSection: SidebarSection;
  sidebarExpanded: boolean;
  onSectionChange: (section: SidebarSection) => void;
  highlightExtraction?: boolean;
  canGoToClusters?: boolean;
  canGoToMetrics?: boolean;
  /** Whether the data stage has completed (rows loaded). */
  dataDone?: boolean;
  /** Whether the extraction stage has completed (properties extracted). */
  extractionDone?: boolean;
  /** Whether clustering has completed (clusters available). */
  clustersDone?: boolean;
  /** Whether metrics/insights have completed (resultsMetrics available). */
  metricsDone?: boolean;
  /** Current running stage for arrow connector animation. */
  currentStage?: 'idle' | 'extraction' | 'clustering';
  /** Callback to download results. If provided, shows download button. */
  onDownloadResults?: () => void;
}

interface IconButtonItemProps {
  icon: React.ReactNode;
  tooltip: string;
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  customColor?: string;
  showActiveBackground?: boolean;
}

function IconButtonItem({
  icon,
  tooltip,
  label,
  active,
  onClick,
  disabled = false,
  highlight = false,
  customColor,
  showActiveBackground = true,
}: IconButtonItemProps) {
  const shouldShowActiveBackground = active && showActiveBackground;
  
  return (
    <Tooltip title={tooltip} placement="right">
      <Box
        onClick={disabled ? undefined : onClick}
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: disabled ? 'default' : 'pointer',
          '&:hover': {
            '& .icon-button': {
              backgroundColor: shouldShowActiveBackground ? 'primary.dark' : 'action.hover',
            },
          },
        }}
      >
        <IconButton
          disabled={disabled}
          className="icon-button"
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: shouldShowActiveBackground ? 'primary.main' : 'transparent',
            color: shouldShowActiveBackground ? 'primary.contrastText' : (customColor || (highlight ? 'warning.main' : 'text.secondary')),
            pointerEvents: 'none', // Disable IconButton's own click handling
            '&.Mui-disabled': {
              color: 'action.disabled',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {icon}
        </IconButton>
        <Typography
          variant="body2"
          sx={{
            color: disabled
              ? 'action.disabled'
              : shouldShowActiveBackground
                ? 'primary.main'
                : 'text.primary',
            fontSize: '1rem',
            lineHeight: 1.2,
            fontWeight: shouldShowActiveBackground ? 600 : 400,
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default function PermanentIconSidebar({
  activeSection,
  sidebarExpanded,
  onSectionChange,
  highlightExtraction = false,
  canGoToClusters = false,
  canGoToMetrics = false,
  dataDone = false,
  extractionDone = false,
  clustersDone = false,
  metricsDone = false,
  currentStage = 'idle',
  onDownloadResults,
}: PermanentIconSidebarProps) {
  const extractionConnectorActive = currentStage === 'extraction';
  const clusteringConnectorActive = currentStage === 'clustering';

  return (
    <Box
      sx={{
        width: 150,
        height: (theme) => `calc(100vh - ${theme.mixins.toolbar.minHeight}px)`,
        backgroundColor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        pt: 4, // Increased top padding
        pb: 3,
        pl: 1, // Reduced left padding
        pr: 1, // Reduced right padding
        position: 'fixed',
        left: 0,
        top: (theme) => `calc(${theme.mixins.toolbar.minHeight}px + 4px)`, // Slightly below header
        zIndex: 1000, // Ensure AppBar/header remains on top
      }}
    >
      <IconButtonItem
        icon={<DataViewIcon />}
        tooltip="Data - View model responses"
        label={
          <>
            Load<br/>
            Data
          </>
        }
        active={activeSection === 'data'}
        onClick={() => onSectionChange('data')}
        customColor={dataDone ? '#10B981' : undefined}
      />

      {/* Progress connector: Data → Extraction */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          ml: '48px', // Center between icon (48px) and label start (with reduced padding)
          color: extractionConnectorActive ? 'primary.main' : 'divider',
          ...(extractionConnectorActive && {
            '@keyframes pulseArrow': {
              '0%': { opacity: 0.4 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.4 },
            },
            animation: 'pulseArrow 1.2s ease-in-out infinite',
          }),
        }}
      >
        <ArrowDownIcon sx={{ fontSize: 32 }} />
      </Box>

      <IconButtonItem
        icon={<PropertyExtractionIcon />}
        tooltip={
          dataDone
            ? 'Extract interesting behaviors'
            : 'Load data to extract behaviors'
        }
        label={
          <>
            Label<br/>
            Behaviors
          </>
        }
        active={activeSection === 'extraction'}
        onClick={() => onSectionChange('extraction')}
        disabled={!dataDone}
        highlight={highlightExtraction}
        customColor="#10B981"
      />

      {/* Progress connector: Extraction → Clusters */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          ml: '48px', // Center between icon (48px) and label start (with reduced padding)
          color: clusteringConnectorActive ? 'primary.main' : 'divider',
          ...(clusteringConnectorActive && {
            '@keyframes pulseArrow': {
              '0%': { opacity: 0.4 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.4 },
            },
            animation: 'pulseArrow 1.2s ease-in-out infinite',
          }),
        }}
      >
        <ArrowDownIcon sx={{ fontSize: 32 }} />
      </Box>

      <IconButtonItem
        icon={<ClustersIcon />}
        tooltip={
          canGoToClusters
            ? 'Clusters - Common behavior patterns'
            : 'Run Label Behaviors to discover clusters'
        }
        label={
          <>
            Cluster<br/>
            Behaviors
          </>
        }
        active={activeSection === 'clusters'}
        onClick={() => onSectionChange('clusters')}
        disabled={!canGoToClusters}
        customColor={clustersDone ? '#10B981' : undefined}
      />

      {/* Progress connector: Clusters → Insights */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          ml: '48px', // Center between icon (48px) and label start (with reduced padding)
          color: 'divider',
        }}
      >
        <ArrowDownIcon sx={{ fontSize: 32 }} />
      </Box>

      <IconButtonItem
        icon={<InsightsIcon />}
        tooltip={
          canGoToMetrics
            ? 'Failures, unique behaviors, and misaligned patterns'
            : 'Run clustering to view insights'
        }
        label={
          <>
            View<br/>
            Insights
          </>
        }
        active={activeSection === 'metrics'}
        onClick={() => onSectionChange('metrics')}
        disabled={!canGoToMetrics}
        customColor={metricsDone ? '#10B981' : undefined}
      />

      {/* Spacer to push download and docs icons to bottom */}
      <Box sx={{ flex: 1, minHeight: 0 }} />

      {onDownloadResults && (
        <Tooltip title="Download Results - Download all results as a ZIP file" placement="right">
          <Box sx={{ mb: 1 }}>
            <IconButton
              onClick={onDownloadResults}
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
              <DownloadIcon />
            </IconButton>
          </Box>
        </Tooltip>
      )}

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

