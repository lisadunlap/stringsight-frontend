/**
 * Generates a file-friendly PDF filename from a prompt string.
 * Takes first 80 characters, replaces spaces with underscores,
 * removes forbidden characters like /, \, ?, %, etc.
 */
export function generatePdfFilename(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    return 'conversation_trace.pdf';
  }

  return prompt
    .slice(0, 80)  // First 80 chars
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[/\\?%*:|"<>]/g, '')  // Remove forbidden file chars
    .replace(/[^\w\-_.]/g, '')  // Keep only alphanumeric, dash, underscore, dot
    .replace(/_{2,}/g, '_')  // Collapse multiple underscores
    .replace(/^_+|_+$/g, '')  // Trim underscores from start/end
    .trim() + '.pdf';
}
