import { createTheme } from "@mui/material/styles";

// Retro Tech color palette - inspired by vintage computing with modern refinement
export const retroColors = {
  // Primary behavior labeling colors (vibrant & distinct)
  blue: "#5B8DEE",      // Brighter IBM blue - stylistic/neutral
  purple: "#9B6FCF",    // Vibrant grape - style variations
  green: "#52C991",     // Brighter terminal green - positive
  orange: "#FF8C42",    // Vivid amber - warnings/non-critical
  red: "#E85D75",       // Punchy error red - critical issues

  // Supporting colors for other UI elements
  blueSubdued: "#4A90E2",    // Original blue for buttons/links
  purpleSubdued: "#8B5FBF",  // Original purple for secondary actions
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: retroColors.blueSubdued, // Use subdued blue for UI elements
    },
    secondary: {
      main: retroColors.purpleSubdued, // Use subdued purple for UI elements
    },
    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#6B7280",
    },
    divider: "#E5E7EB",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      "Avenir",
      "Avenir Next",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "Helvetica Neue",
      "Arial",
      "Noto Sans",
      "sans-serif",
    ].join(","),
    h6: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#111827",
          borderBottom: "2px solid #E5E7EB",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 8 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined" },
    },
    MuiContainer: {
      styleOverrides: {
        root: { paddingTop: 16, paddingBottom: 16 },
      },
    },
  },
});


