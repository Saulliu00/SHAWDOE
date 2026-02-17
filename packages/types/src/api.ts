import type { CommentInput, CommentResult, Platform, WarmthLevel } from './comment';

export interface ProcessCommentsRequest {
  comments: CommentInput[];
  platform: Platform;
  context?: {
    videoId?: string;
    channelName?: string;
  };
  clientId: string;
  warmth?: WarmthLevel;
}

export interface ProcessCommentsResponse {
  results: CommentResult[];
  metadata: {
    processedAt: string;
    cachedCount: number;
    processedCount: number;
    batchId: string;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export interface StatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    dynamodb: 'up' | 'down';
    bedrock: 'up' | 'down';
  };
}

export interface StatsResponse {
  totalCommentsProcessed: number;
  totalCommentsReframed: number;
  cacheHitRate: number;
  averageToxicityRate: number;
  platformBreakdown: {
    youtube: { processed: number; reframed: number };
    twitch: { processed: number; reframed: number };
  };
}
