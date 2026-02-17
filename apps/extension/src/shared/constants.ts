import type { ExtensionConfig } from '@kindwords/types';

export const DEFAULT_CONFIG: ExtensionConfig = {
  enabled: true,
  platforms: {
    youtube: true,
    twitch: true,
  },
  sensitivityThreshold: 'mild',
  warmth: 'medium',
  apiBaseUrl: 'https://api.kindwords.app/v1',
  batchSize: 25,
  batchFlushIntervalMs: 2000,
};

export const STORAGE_KEYS = {
  CONFIG: 'kindwords_config',
  CLIENT_ID: 'kindwords_client_id',
  STATS: 'kindwords_stats',
  CACHE: 'kindwords_cache',
} as const;

export const BADGE_CLASS = 'kindwords-badge';
export const REFRAMED_CLASS = 'kindwords-reframed';
export const TOOLTIP_CLASS = 'kindwords-tooltip';
