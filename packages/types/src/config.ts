import type { ToxicityLevel, WarmthLevel } from './comment';

export interface ExtensionConfig {
  enabled: boolean;
  platforms: {
    youtube: boolean;
    twitch: boolean;
  };
  sensitivityThreshold: ToxicityLevel;
  warmth: WarmthLevel;
  apiBaseUrl: string;
  batchSize: number;
  batchFlushIntervalMs: number;
}

export interface BackendConfig {
  cacheTableName: string;
  statsTableName: string;
  rateLimitTableName: string;
  bedrock: {
    region: string;
    classifierModelId: string;
    reframerModelId: string;
    suggesterModelId: string;
    maxTokens: number;
    temperature: number;
  };
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    batchSizeLimit: number;
  };
}
