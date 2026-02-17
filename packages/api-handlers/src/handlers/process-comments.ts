import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import type { CommentResult } from '@kindwords/types';
import { Logger, hashContent, normalizeText } from '@kindwords/utils';
import {
  KindWordsPipeline,
  BedrockClient,
  ToxicityClassifier,
  EmotionalReframer,
  ResponseSuggester,
} from '@kindwords/llm-pipeline';
import { CacheRepository, StatsRepository, RateLimitRepository } from '@kindwords/data-access';
import { jsonResponse } from '../middleware/cors';
import { processCommentsSchema, validateRequest } from '../middleware/validator';
import { checkRateLimit } from '../middleware/rate-limiter';
import { handleError } from '../middleware/error-handler';

const logger = new Logger('ProcessComments');

// Initialize outside handler for Lambda reuse
const cacheRepo = new CacheRepository(process.env.CACHE_TABLE!);
const statsRepo = new StatsRepository(process.env.STATS_TABLE!);
const rateLimitRepo = new RateLimitRepository(process.env.RATE_LIMIT_TABLE!);

const classifierClient = new BedrockClient({
  region: process.env.BEDROCK_REGION ?? 'us-east-1',
  modelId: process.env.BEDROCK_MODEL_CLASSIFIER ?? 'amazon.nova-2-lite-v1:0',
  maxTokens: 1024,
  temperature: 0.1,
});

const reframerClient = new BedrockClient({
  region: process.env.BEDROCK_REGION ?? 'us-east-1',
  modelId: process.env.BEDROCK_MODEL_REFRAMER ?? 'amazon.nova-2-lite-v1:0',
  maxTokens: 2048,
  temperature: 0.7,
});

const suggesterClient = new BedrockClient({
  region: process.env.BEDROCK_REGION ?? 'us-east-1',
  modelId: process.env.BEDROCK_MODEL_SUGGESTER ?? 'amazon.nova-2-lite-v1:0',
  maxTokens: 1024,
  temperature: 0.7,
});

const pipeline = new KindWordsPipeline(
  new ToxicityClassifier(classifierClient),
  new EmotionalReframer(reframerClient),
  new ResponseSuggester(suggesterClient),
);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId ?? randomUUID();
  const origin = event.headers?.origin ?? event.headers?.Origin;

  try {
    // Parse and validate
    const body = JSON.parse(event.body ?? '{}');
    const validation = validateRequest(processCommentsSchema, body);

    if (!validation.success) {
      return jsonResponse(
        400,
        { error: { code: 'INVALID_REQUEST', message: validation.error }, requestId },
        origin,
      );
    }

    const { comments, platform, clientId } = validation.data;

    // Rate limit check
    const rateLimited = await checkRateLimit(clientId, rateLimitRepo, requestId, origin);
    if (rateLimited) return rateLimited;

    logger.info('Processing comments', {
      requestId,
      count: comments.length,
      platform,
    });

    // Check cache for each comment
    const results: CommentResult[] = new Array(comments.length);
    const uncachedIndices: number[] = [];
    let cachedCount = 0;

    await Promise.all(
      comments.map(async (comment, index) => {
        const hash = hashContent(normalizeText(comment.text));
        const cached = await cacheRepo.get(hash);

        if (cached) {
          results[index] = {
            id: comment.id,
            original: comment.text,
            toxicity: cached.toxicity,
            reframed: cached.reframed,
            suggestedResponse: cached.suggestedResponse,
            fromCache: true,
          };
          cachedCount++;
        } else {
          uncachedIndices.push(index);
        }
      }),
    );

    // Process uncached comments through pipeline
    if (uncachedIndices.length > 0) {
      const uncachedComments = uncachedIndices.map((i) => comments[i]);
      const pipelineResults = await pipeline.processBatch(uncachedComments);

      // Store results and cache them
      await Promise.all(
        uncachedIndices.map(async (originalIndex, batchIndex) => {
          const comment = comments[originalIndex];
          const result = pipelineResults[batchIndex];
          const hash = hashContent(normalizeText(comment.text));

          results[originalIndex] = {
            id: comment.id,
            original: comment.text,
            toxicity: result.toxicity,
            reframed: result.reframed,
            suggestedResponse: result.suggestedResponse,
            fromCache: false,
          };

          // Cache the result
          await cacheRepo.put({
            contentHash: hash,
            originalText: comment.text,
            toxicity: result.toxicity,
            reframed: result.reframed,
            suggestedResponse: result.suggestedResponse,
            platform,
          });
        }),
      );
    }

    // Update stats
    const reframedCount = results.filter((r) => r.toxicity.isToxic).length;
    await Promise.all([
      statsRepo.incrementProcessed(platform, comments.length),
      reframedCount > 0 ? statsRepo.incrementReframed(platform, reframedCount) : Promise.resolve(),
    ]);

    logger.info('Processing complete', {
      requestId,
      total: comments.length,
      cached: cachedCount,
      processed: uncachedIndices.length,
      reframed: reframedCount,
    });

    return jsonResponse(
      200,
      {
        results,
        metadata: {
          processedAt: new Date().toISOString(),
          cachedCount,
          processedCount: uncachedIndices.length,
          batchId: requestId,
        },
      },
      origin,
    );
  } catch (error) {
    return handleError(error, requestId, origin);
  }
}
