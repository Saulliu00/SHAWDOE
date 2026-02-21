import type {
  ExtensionMessage,
  ExtensionResponse,
  CommentResult,
  ProcessBatchPayload,
} from '@kindwords/types';
import { ApiClient } from './api-client';
import { CacheManager } from './cache-manager';
import { ClientRateLimiter } from './rate-limiter';
import { getConfig, setConfig, getLocalStats, incrementLocalStats } from '../shared/storage';

export class MessageRouter {
  constructor(
    private apiClient: ApiClient,
    private cache: CacheManager,
    private rateLimiter: ClientRateLimiter,
  ) {}

  async handle(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void,
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'PROCESS_BATCH': {
          // Inject warmth from user config into the batch payload
          const config = await getConfig();
          const enrichedPayload = { ...message.payload, warmth: message.payload.warmth ?? config.warmth };
          await this.handleProcessBatch(enrichedPayload, sendResponse);
          break;
        }

        case 'GET_CONFIG': {
          const config = await getConfig();
          sendResponse({ type: 'CONFIG', payload: config });
          break;
        }

        case 'UPDATE_CONFIG': {
          await setConfig(message.payload);
          const updated = await getConfig();
          sendResponse({ type: 'CONFIG', payload: updated });
          break;
        }

        case 'GET_STATS': {
          const stats = await getLocalStats();
          sendResponse({ type: 'STATS', payload: stats });
          break;
        }

        case 'CLEAR_CACHE': {
          await chrome.storage.local.remove('kindwords_cache');
          sendResponse({ type: 'STATS', payload: await getLocalStats() });
          break;
        }

        default:
          sendResponse({
            type: 'ERROR',
            payload: { code: 'UNKNOWN_MESSAGE', message: 'Unknown message type' },
          });
      }
    } catch (error) {
      sendResponse({
        type: 'ERROR',
        payload: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async handleProcessBatch(
    payload: ProcessBatchPayload,
    sendResponse: (response: ExtensionResponse) => void,
  ): Promise<void> {
    if (!this.rateLimiter.isAllowed()) {
      sendResponse({
        type: 'ERROR',
        payload: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
      return;
    }

    const results: CommentResult[] = [];
    const uncachedComments: ProcessBatchPayload['comments'] = [];
    const uncachedIndices: number[] = [];

    // Check local cache
    for (let i = 0; i < payload.comments.length; i++) {
      const comment = payload.comments[i];
      const cached = await this.cache.get(comment.contentHash);
      if (cached) {
        results[i] = { ...cached, id: comment.id };
      } else {
        uncachedComments.push(comment);
        uncachedIndices.push(i);
      }
    }

    // Send uncached to API
    if (uncachedComments.length > 0) {
      const response = await this.apiClient.processComments({
        comments: uncachedComments,
        platform: payload.platform,
        context: payload.context,
        warmth: payload.warmth,
      });

      for (let j = 0; j < response.results.length; j++) {
        const result = response.results[j];
        const originalIndex = uncachedIndices[j];
        results[originalIndex] = result;

        // Cache the result locally
        await this.cache.set(uncachedComments[j].contentHash, result);
      }
    }

    // Update local stats — all comments are rewritten
    const rewrittenCount = results.filter((r) => r.reframed).length;
    if (rewrittenCount > 0) {
      await incrementLocalStats(rewrittenCount);
    }

    sendResponse({ type: 'PROCESS_BATCH_RESULT', payload: results });
  }
}
