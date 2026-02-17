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

    // Atomic increment-if-under-limit within the current window.
    // If the window has expired, reset the counter to 1.
    // If the counter is at or over the limit, the condition fails.
    try {
      const result = await client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { clientId },
          UpdateExpression:
            'SET requestCount = if_not_exists(requestCount, :zero) + :one, windowStart = :ws, #t = :ttl',
          ConditionExpression:
            'attribute_not_exists(windowStart) OR windowStart < :ws OR requestCount < :limit',
          ExpressionAttributeNames: { '#t': 'ttl' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':one': 1,
            ':ws': windowStart,
            ':limit': this.maxRequestsPerWindow,
            ':ttl': now + TTL_SECONDS,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      const newCount = (result.Attributes?.requestCount as number) ?? 1;

      // If the window just rolled over, the count includes stale data.
      // DynamoDB incremented the old count. We need a second pass to reset.
      const storedWindow = result.Attributes?.windowStart as number;
      if (storedWindow < windowStart) {
        // Window expired mid-flight — reset atomically
        await client.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { clientId },
            UpdateExpression: 'SET requestCount = :one, windowStart = :ws, #t = :ttl',
            ConditionExpression: 'windowStart < :ws',
            ExpressionAttributeNames: { '#t': 'ttl' },
            ExpressionAttributeValues: {
              ':one': 1,
              ':ws': windowStart,
              ':ttl': now + TTL_SECONDS,
            },
          }),
        ).catch(() => {
          // Another request already reset the window — that's fine
        });

        return {
          allowed: true,
          remaining: this.maxRequestsPerWindow - 1,
          resetAt: windowStart + WINDOW_SECONDS,
        };
      }

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
