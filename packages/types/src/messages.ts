import type { CommentResult, Platform, WarmthLevel } from './comment';
import type { ExtensionConfig } from './config';

export type ExtensionMessage =
  | { type: 'PROCESS_BATCH'; payload: ProcessBatchPayload }
  | { type: 'GET_CONFIG'; payload: undefined }
  | { type: 'UPDATE_CONFIG'; payload: Partial<ExtensionConfig> }
  | { type: 'GET_STATS'; payload: undefined }
  | { type: 'CLEAR_CACHE'; payload: undefined };

export interface ProcessBatchPayload {
  comments: Array<{
    id: string;
    text: string;
    author: string;
    contentHash: string;
  }>;
  platform: Platform;
  warmth?: WarmthLevel;
  context?: {
    videoId?: string;
    channelName?: string;
  };
}

export type ExtensionResponse =
  | { type: 'PROCESS_BATCH_RESULT'; payload: CommentResult[] }
  | { type: 'CONFIG'; payload: ExtensionConfig }
  | { type: 'STATS'; payload: { todayReframed: number; totalReframed: number } }
  | { type: 'ERROR'; payload: { code: string; message: string } };
