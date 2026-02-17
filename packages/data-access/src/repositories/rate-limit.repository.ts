import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { Logger } from '@kindwords/utils';
import { getDocClient } from '../client';

const WINDOW_SECONDS = 60; // 1-minute fixed window
const TTL_SECONDS = 3600;

export class RateLimitRepository {
  private logger: Logger;

  constructor(
    private tableName: string,
    private maxRequestsPerWindow: number = 60,
  ) {
    this.logger = new Logger('RateLimitRepository');
  }

  async checkAndIncrement(clientId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const client = getDocClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % WINDOW_SECONDS);

    // Strategy: Use separate operations for same-window increment vs window reset.
    // This avoids the race condition where increment+reset in one expression
    // would add to a stale count and then try to fix it non-atomically.

    // Attempt 1: Increment within the current window
    try {
      const result = await client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { clientId },
          UpdateExpression:
            'SET requestCount = requestCount + :one, #t = :ttl',
          ConditionExpression:
            'attribute_exists(windowStart) AND windowStart = :ws AND requestCount < :limit',
          ExpressionAttributeNames: { '#t': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':ws': windowStart,
            ':limit': this.maxRequestsPerWindow,
            ':ttl': now + TTL_SECONDS,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      const newCount = (result.Attributes?.requestCount as number) ?? 1;
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequestsPerWindow - newCount),
        resetAt: windowStart + WINDOW_SECONDS,
      };
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
      // Condition failed: either new item, window expired, or limit reached.
    }

    // Attempt 2: Reset the window (new item or expired window)
    try {
      await client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { clientId },
          UpdateExpression:
            'SET requestCount = :one, windowStart = :ws, #t = :ttl',
          ConditionExpression:
            'attribute_not_exists(windowStart) OR windowStart < :ws',
          ExpressionAttributeNames: { '#t': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':ws': windowStart,
            ':ttl': now + TTL_SECONDS,
          },
        }),
      );

      return {
        allowed: true,
        remaining: this.maxRequestsPerWindow - 1,
        resetAt: windowStart + WINDOW_SECONDS,
      };
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
      // Another request already reset the window — try increment one more time.
    }

    // Attempt 3: Retry increment after concurrent reset
    try {
      const result = await client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { clientId },
          UpdateExpression:
            'SET requestCount = requestCount + :one, #t = :ttl',
          ConditionExpression:
            'windowStart = :ws AND requestCount < :limit',
          ExpressionAttributeNames: { '#t': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':ws': windowStart,
            ':limit': this.maxRequestsPerWindow,
            ':ttl': now + TTL_SECONDS,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      const newCount = (result.Attributes?.requestCount as number) ?? 1;
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequestsPerWindow - newCount),
        resetAt: windowStart + WINDOW_SECONDS,
      };
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.warn('Rate limit exceeded', { clientId: clientId.slice(0, 8) });
        return {
          allowed: false,
          remaining: 0,
          resetAt: windowStart + WINDOW_SECONDS,
        };
      }
      throw error;
    }
  }
}
