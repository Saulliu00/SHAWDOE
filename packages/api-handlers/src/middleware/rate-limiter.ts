import type { APIGatewayProxyResult } from 'aws-lambda';
import { RateLimitRepository } from '@kindwords/data-access';
import { jsonResponse } from './cors';

export async function checkRateLimit(
  clientId: string,
  rateLimitRepo: RateLimitRepository,
  requestId: string,
  origin?: string,
): Promise<APIGatewayProxyResult | null> {
  const result = await rateLimitRepo.checkAndIncrement(clientId);

  if (!result.allowed) {
    return jsonResponse(
      429,
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: { resetAt: result.resetAt },
        },
        requestId,
      },
      origin,
    );
  }

  return null; // Not rate limited
}
