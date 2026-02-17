import type { CommentResult, Platform } from '@kindwords/types';
import type { ExtractedComment } from '../platforms/types';
import { replaceBatch } from '../dom/comment-replacer';
import { Debouncer } from './debouncer';

export interface QueueConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxBatchSize: 25,
  flushIntervalMs: 2000,
};

export class CommentQueue {
  private queue: ExtractedComment[] = [];
  private debouncer = new Debouncer();
  private seenHashes = new Set<string>();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  enqueue(comments: ExtractedComment[]): void {
    for (const comment of comments) {
      // Simple dedup by text content
      const key = comment.text.trim().toLowerCase();
      if (this.seenHashes.has(key)) continue;

      this.seenHashes.add(key);
      this.queue.push(comment);
    }

    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush();
    } else if (this.queue.length > 0) {
      this.debouncer.schedule(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.config.maxBatchSize);
    this.debouncer.cancel();

    // Remove flushed items from dedup set so re-appearing comments can be processed
    for (const comment of batch) {
      this.seenHashes.delete(comment.text.trim().toLowerCase());
    }

    try {
      const payload = batch.map((c) => ({
        id: c.id,
        text: c.text,
        author: c.author,
        contentHash: c.text.trim().toLowerCase(),
      }));

      const response = await chrome.runtime.sendMessage({
        type: 'PROCESS_BATCH',
        payload: {
          comments: payload,
          platform: batch[0].platform,
        },
      });

      if (response?.type === 'PROCESS_BATCH_RESULT') {
        const results = response.payload as CommentResult[];
        replaceBatch(batch, results);
      }
    } catch (error) {
      console.error('[KindWords] Failed to process batch:', error);
    }
  }

  clear(): void {
    this.queue = [];
    this.seenHashes.clear();
    this.debouncer.cancel();
  }
}
