import type { APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@kindwords/utils';
import { jsonResponse } from './cors';

const logger = new Logger('ErrorHandler');

export function handleError(error: unknown, requestId: string, origin?: string): APIGatewayProxyResult {
  logger.error('Unhandled error', {
    requestId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof Error && error.message.includes('ThrottlingException')) {
    return jsonResponse(
      503,
      {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' },
        requestId,
      },
      origin,
    );
  }

  return jsonResponse(
    500,
    {
      error: { code: 'PIPELINE_ERROR', message: 'Internal processing error' },
      requestId,
    },
    origin,
  );
}
