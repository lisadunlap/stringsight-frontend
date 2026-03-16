# Demo Mode Suggestions for TutorialContext.tsx

## 1. Update Tutorial Step Text to Match New Button Labels

The tutorial step descriptions should reference the updated button text:
- Step 3: Update "Extract on Row 0" → "Extract for Selected Row"
- Step 5: Update "Run on all traces" → "Run Extraction on Entire Dataset"

## 2. Add Demo Mode Detection

Add a prop or context to detect when the app is in demo mode, which can:
- Automatically start the tutorial when demo data is loaded
- Show demo-specific messaging
- Disable certain tutorial steps that aren't relevant in demo mode

## 3. Improve Tutorial Step 1

The first step mentions "Load Taubench" but could be clearer:
- Consider updating the title to "Welcome to the Demo Dataset"
- Clarify that the demo data is pre-loaded and ready to explore

## 4. Add Progress Indicator

Consider adding a step indicator (e.g., "Step 2 of 5") to help users understand their progress through the tutorial.

## 5. Update Step 3 Body Text

The body text for step 3 should be updated to reflect the new button label:
- Current: "Start by extracting properties for row 0..."
- Suggested: "Start by extracting properties for the selected row. This lets you preview how the extractor works on one example before running it on all rows."

## 6. Update Step 5 Body Text

The body text for step 5 should reference the new button label:
- Current: "Once you like the properties extracted from row 0, click 'Run on all traces'..."
- Suggested: "Once you like the properties extracted from the selected row, click 'Run Extraction on Entire Dataset' to apply the extractor to the entire dataset."

## 7. Add Demo Mode Context

Consider adding a `isDemoMode` flag to the tutorial context that can be used to:
- Customize tutorial messaging
- Show/hide certain steps
- Adjust tutorial behavior based on mode

## 8. Improve Tutorial Completion Flow

When the tutorial is completed in demo mode:
- Consider showing a completion message
- Optionally suggest next steps (e.g., "Try uploading your own data")
- Provide a way to restart the tutorial

