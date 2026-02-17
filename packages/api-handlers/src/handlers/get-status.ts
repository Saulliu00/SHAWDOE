import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { StatusResponse } from '@kindwords/types';
import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { jsonResponse } from '../middleware/cors';

// Reuse client across Lambda invocations (warm starts)
const ddbClient = new DynamoDBClient({});

async function checkDynamo(): Promise<'up' | 'down'> {
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: process.env.CACHE_TABLE! }));
    return 'up';
  } catch {
    return 'down';
  }
}

function resolveStatus(dynamo: 'up' | 'down', bedrock: 'up' | 'down'): StatusResponse['status'] {
  if (dynamo === 'up' && bedrock === 'up') return 'healthy';
  if (dynamo === 'down' && bedrock === 'down') return 'unhealthy';
  return 'degraded';
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const origin = event.headers?.origin ?? event.headers?.Origin;

  const dynamoStatus = await checkDynamo();
  const bedrockStatus: 'up' | 'down' = 'up'; // Assume up unless we add a health probe

  const response: StatusResponse = {
    status: resolveStatus(dynamoStatus, bedrockStatus),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      dynamodb: dynamoStatus,
      bedrock: bedrockStatus,
    },
  };

  return jsonResponse(200, response, origin);
}
