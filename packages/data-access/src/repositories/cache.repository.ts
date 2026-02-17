import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ToxicityClassification, Platform } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import { getDocClient } from '../client';

export interface CacheEntry {
  contentHash: string;
  originalText: string;
  toxicity: ToxicityClassification;
  reframed: string | null;
  suggestedResponse: string | null;
  platform: Platform;
  createdAt: string;
  ttl: number;
}

const TTL_SECONDS = 86400; // 24 hours

export class CacheRepository {
  private logger: Logger;

  constructor(private tableName: string) {
    this.logger = new Logger('CacheRepository');
  }

  async get(contentHash: string): Promise<CacheEntry | null> {
    const client = getDocClient();

    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { contentHash },
      }),
    );

    if (!result.Item) {
      this.logger.debug('Cache miss', { contentHash: contentHash.slice(0, 8) });
      return null;
    }

    this.logger.debug('Cache hit', { contentHash: contentHash.slice(0, 8) });
    return result.Item as CacheEntry;
  }

  async put(entry: Omit<CacheEntry, 'createdAt' | 'ttl'>): Promise<void> {
    const client = getDocClient();
    const now = new Date();

    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...entry,
          createdAt: now.toISOString(),
          ttl: Math.floor(now.getTime() / 1000) + TTL_SECONDS,
        },
      }),
    );

    this.logger.debug('Cache write', { contentHash: entry.contentHash.slice(0, 8) });
  }
}
