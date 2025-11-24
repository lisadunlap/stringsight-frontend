import React from 'react';
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Button,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FindInPageIcon from '@mui/icons-material/FindInPage';

interface DemoGuidancePopupProps {
  /**
   * Which tab/section the popup is for. Determines the content shown.
   */
  section: 'data' | 'properties' | 'clusters' | 'metrics';
  /**
   * Callback when user dismisses the popup.
   */
  onDismiss: () => void;
}

/**
 * Contextual guidance popup that appears when demo data is loaded.
 * Provides helpful scaffolding to orient users to different sections of the app.
 */
export default function DemoGuidancePopup({
  section,
  onDismiss,
}: DemoGuidancePopupProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const content = React.useMemo(() => {
    switch (section) {
      case 'data':
        return {
          title: 'This is your data, have a look around!',
          // message: 'See model performance, individual traces, and filter your dataframe to only show successes or failures.',
          highlights: [
            'Click "View" in any row to see the full conversation trace',
            'Use the filter bar to narrow down to specific rows',
            'Check the performance metrics in the table header',
          ],
          action: 'Once you\'ve explored your data, click "Label Behaviors" in the left sidebar to automatically analyze your traces',
        };
      case 'properties':
        return {
          title: 'Extract behavioral properties',
          message: 'Use an LLM annotator to identify patterns and behaviors in your model responses. Each behavior will be labeled as positive, negative, or stylistic, along with some other metadata tags.',
          hasColoredMessage: true,
          highlights: [
            'The task description box is used to help guide the LLM in its analysis. Editing is disabled for this demo but upload your own data to try it out!',
            'Click Label Trace at Row 0 to see the behaviors extracted on a single trace.',
            'Behaviors will appear as rows on the properties table below. Click on the response to see the full trace and evidence that led to the behavior.',
            'Run Label and Cluster All Traces once you like the results to get dataset level insights',
          ],
        };
      case 'clusters':
        return {
          title: 'Explore clustered behaviors',
          message: 'See how your data groups by similar behaviors and patterns.',
          highlights: [
            'Click any cluster row to explore its details',
            'Left hand bar chart shows the frequency of each behavior for each model',
            'View the insights tab to see a summary of the clusters and their properties',
          ],
        };
      case 'metrics':
        return {
          title: 'Get high-level insights',
          message: 'See why models fail, how they differ, and what behaviors most impact performance.',
          highlights: [
            'Common faliures tab shows negative behaviors that are common across models',
            'Model comparison tab shows behaviors specific to each model',
            'Misaligned patterns tab shows behaviors that signifigantly impact performance',
          ],
        };
      default:
        return null;
    }
  }, [section]);

  if (!content) return null;

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'relative',
        mb: 2,
        p: isExpanded ? 2.5 : 1.5,
        backgroundColor: '#f0fdf4',
        border: '2px solid #10b981',
        borderRadius: 0,
        display: 'flex',
        gap: 2,
        alignItems: isExpanded ? 'flex-start' : 'center',
        cursor: isExpanded ? 'default' : 'pointer',
        transition: 'all 0.3s ease',
      }}
      onClick={isExpanded ? undefined : () => setIsExpanded(true)}
    >
      <InfoOutlinedIcon
        sx={{
          color: '#10b981',
          fontSize: 28,
          flexShrink: 0,
          mt: isExpanded ? 0.25 : 0,
        }}
      />

      <Box sx={{ flex: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: '#065f46',
            mb: isExpanded ? 0.5 : 0,
          }}
        >
          {content.title}
        </Typography>

        {isExpanded && (
          <>
            {content.message && (
              <Typography
                variant="body2"
                sx={{
                  color: '#047857',
                  mb: 1.5,
                }}
              >
                {content.hasColoredMessage ? (
                  <>
                    Use an LLM annotator to identify patterns and behaviors in your model responses. Each behavior will be labeled as <Box component="span" sx={{ color: '#10b981', fontWeight: 600 }}>positive</Box>, <Box component="span" sx={{ color: '#dc2626', fontWeight: 600 }}>negative (critical)</Box>, <Box component="span" sx={{ color: '#f97316', fontWeight: 600 }}>negative (non-critical)</Box>, or <Box component="span" sx={{ color: '#9333ea', fontWeight: 600 }}>stylistic</Box>, along with some other metadata tags.
                  </>
                ) : (
                  content.message
                )}
              </Typography>
            )}

            <Stack spacing={0.75}>
              {content.highlights.map((highlight, idx) => {
                // Check for specific highlights that need emphasis
                const isLabelTraceHighlight = highlight.includes('Label Trace at Row 0');
                const isLabelAndClusterHighlight = highlight.includes('Label and Cluster All Traces');

                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        flexShrink: 0,
                        mt: 0.75,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#047857',
                        fontSize: '0.875rem',
                      }}
                    >
                      {isLabelTraceHighlight ? (
                        <>
                          Click <Box component="span" sx={{ color: '#065f46', fontWeight: 600 }}>Label Trace at Row 0</Box> to see the behaviors extracted on a single trace.
                        </>
                      ) : isLabelAndClusterHighlight ? (
                        <>
                          Run <Box component="span" sx={{ color: '#065f46', fontWeight: 600 }}>Label and Cluster All Traces</Box> once you like the results to get dataset level insights
                        </>
                      ) : (
                        highlight
                      )}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>

            {content.action && (
              <Box
                sx={{
                  mt: 1.5,
                  pt: 1.5,
                  borderTop: '1px solid #d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <ArrowBackIcon sx={{ color: '#10b981', fontSize: 28, flexShrink: 0 }} />
                <FindInPageIcon sx={{ color: '#10B981', fontSize: 24, flexShrink: 0 }} />
                <Typography
                  variant="body1"
                  sx={{
                    color: '#065f46',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                  }}
                >
                  {content.action}
                </Typography>
              </Box>
            )}

            <Button
              size="small"
              onClick={() => setIsExpanded(false)}
              sx={{
                mt: 1.5,
                color: '#10b981',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#d1fae5',
                },
              }}
            >
              Got it
            </Button>
          </>
        )}

        {!isExpanded && (
          <Typography
            variant="body2"
            sx={{
              color: '#047857',
              fontSize: '0.875rem',
            }}
          >
            Click to show guidance
          </Typography>
        )}
      </Box>

      {isExpanded && (
        <IconButton
          size="small"
          onClick={onDismiss}
          sx={{
            color: '#64748b',
            '&:hover': {
              backgroundColor: '#d1fae5',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Paper>
  );
}
