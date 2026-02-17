import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Platform } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import { getDocClient } from '../client';

export class StatsRepository {
  private logger: Logger;

  constructor(private tableName: string) {
    this.logger = new Logger('StatsRepository');
  }

  async incrementProcessed(platform: Platform, count: number): Promise<void> {
    const client = getDocClient();
    const dateKey = new Date().toISOString().split('T')[0];

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `DAILY#${dateKey}`, sk: platform },
        UpdateExpression:
          'SET #p = if_not_exists(#p, :zero) + :count, #u = :now',
        ExpressionAttributeNames: {
          '#p': 'processed',
          '#u': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':count': count,
          ':zero': 0,
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  async incrementReframed(platform: Platform, count: number): Promise<void> {
    const client = getDocClient();
    const dateKey = new Date().toISOString().split('T')[0];

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `DAILY#${dateKey}`, sk: platform },
        UpdateExpression:
          'SET #r = if_not_exists(#r, :zero) + :count, #u = :now',
        ExpressionAttributeNames: {
          '#r': 'reframed',
          '#u': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':count': count,
          ':zero': 0,
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  async getStats(): Promise<{
    totalProcessed: number;
    totalReframed: number;
    platformBreakdown: {
      youtube: { processed: number; reframed: number };
      twitch: { processed: number; reframed: number };
    };
  }> {
    const client = getDocClient();
    const dateKey = new Date().toISOString().split('T')[0];

    const [ytResult, twResult] = await Promise.all([
      client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `DAILY#${dateKey}`, sk: 'youtube' },
        }),
      ),
      client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `DAILY#${dateKey}`, sk: 'twitch' },
        }),
      ),
    ]);

    const yt = {
      processed: (ytResult.Item?.processed as number) ?? 0,
      reframed: (ytResult.Item?.reframed as number) ?? 0,
    };
    const tw = {
      processed: (twResult.Item?.processed as number) ?? 0,
      reframed: (twResult.Item?.reframed as number) ?? 0,
    };

    return {
      totalProcessed: yt.processed + tw.processed,
      totalReframed: yt.reframed + tw.reframed,
      platformBreakdown: { youtube: yt, twitch: tw },
    };
  }
}
