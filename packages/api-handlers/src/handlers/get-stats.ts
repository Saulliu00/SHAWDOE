import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { StatsResponse } from '@kindwords/types';
import { StatsRepository } from '@kindwords/data-access';
import { jsonResponse } from '../middleware/cors';

const statsRepo = new StatsRepository(process.env.STATS_TABLE!);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const origin = event.headers?.origin ?? event.headers?.Origin;

  try {
    const stats = await statsRepo.getStats();

    const response: StatsResponse = {
      totalCommentsProcessed: stats.totalProcessed,
      totalCommentsRewritten: stats.totalReframed,
      cacheHitRate: 0, // Would need additional tracking
      platformBreakdown: {
        youtube: {
          processed: stats.platformBreakdown.youtube.processed,
          rewritten: stats.platformBreakdown.youtube.reframed,
        },
        twitch: {
          processed: stats.platformBreakdown.twitch.processed,
          rewritten: stats.platformBreakdown.twitch.reframed,
        },
      },
    };

    return jsonResponse(200, response, origin);
  } catch (error) {
    return jsonResponse(
      500,
      {
        error: {
          code: 'PIPELINE_ERROR',
          message: 'Failed to retrieve stats',
        },
        requestId: event.requestContext.requestId,
      },
      origin,
    );
  }
}
