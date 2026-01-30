/**
 * Application configuration constants
 * Centralized location for external links and global configuration values
 */

export const EXTERNAL_LINKS = {
  /** Starter notebook (Google Colab) */
  STARTER_NOTEBOOK: 'https://colab.research.google.com/drive/1KQiLi6slA29BPMDMAMh_J7xXAYMuyZC_',
  
  /** GitHub repository */
  GITHUB: 'https://github.com/lisadunlap/StringSight',
  
  /** Documentation site */
  DOCUMENTATION: 'https://lisadunlap.github.io/StringSight/',
} as const;

/**
 * URL for fetching datasets.yaml configuration
 * Falls back to /datasets.yaml (public folder) if not set
 */
export const DATASETS_CONFIG_URL = 
  (import.meta as any).env?.VITE_DATASETS_URL || 
  (globalThis as any)?.VITE_DATASETS_URL;





