/** Normalize behavior_type for matching (lowercase, underscores, no extra chars). */
function normalizeBehaviorType(bt: string): string {
  return String(bt ?? '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

/** Strip role prefix (e.g. non_user_, user_, assistant_) to get base behavior type for lookup. */
function stripRolePrefix(bt: string): string {
  const normalized = normalizeBehaviorType(bt);
  const rolePrefixes = ['non_user_', 'user_', 'assistant_', 'tool_', 'system_'];
  for (const prefix of rolePrefixes) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

/**
 * Returns the display label for a behavior_type value.
 * Handles role-prefixed values (e.g. non_user_style -> Style).
 * User types: Phrasing, Problem Domain, Skills Required.
 * Assistant types: Positive, Negative (critical), Negative (non-critical), Style.
 */
export function getBehaviorTypeDisplayLabel(behaviorType: string): string {
  const type = stripRolePrefix(behaviorType);
  if (type === 'phrasing') return 'Phrasing';
  if (type === 'domain' || type === 'problem_domain') return 'Problem Domain';
  if (type === 'skills_required' || type === 'skillsrequired') return 'Skills Required';
  if (type === 'positive') return 'Positive';
  if (type === 'negative_(critical)' || type === 'negative(critical)' || type === 'negative_critical') return 'Negative (critical)';
  if (type === 'negative_(non-critical)' || type === 'negative(non-critical)' || type === 'negative_non_critical') return 'Negative (non-critical)';
  if (type === 'style' || type === 'stylistic') return 'Style';
  return String(behaviorType ?? '').trim() || '';
}

/**
 * Returns a color for a behavior_type value. Used for Chips and tags in PropertiesTab,
 * PropertyCard, and PropertiesOverviewBanner.
 *
 * Covers model behavior types (positive, negative critical, negative non-critical, style)
 * and user property types (phrasing, domain/problem_domain, skills_required).
 */
export function getBehaviorTypeColor(behaviorType: string): string {
  const type = stripRolePrefix(behaviorType);
  if (type === 'positive') return '#10B981';
  if (type === 'negative_(critical)' || type === 'negative(critical)' || type === 'negative_critical') return '#EF4444';
  if (type === 'negative_(non-critical)' || type === 'negative(non-critical)' || type === 'negative_non_critical') return '#FF8C42';
  if (type === 'style') return '#8B5CF6';
  if (type === 'phrasing') return '#0EA5E9';
  if (type === 'domain' || type === 'problem_domain') return '#06B6D4';
  if (type === 'skills_required' || type === 'skillsrequired') return '#14B8A6';
  // Custom types: hash for consistent color
  if (type) {
    let h = 0;
    for (let i = 0; i < type.length; i++) h = ((h << 5) - h) + type.charCodeAt(i) | 0;
    const hue = Math.abs(h % 360);
    return `hsl(${hue}, 65%, 45%)`;
  }
  return '#6B7280'; // gray for empty/unknown
}

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
