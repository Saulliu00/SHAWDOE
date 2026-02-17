import type { APIGatewayProxyResult } from 'aws-lambda';

const ALLOWED_ORIGINS = [
  'https://www.youtube.com',
  'https://www.twitch.tv',
];

export function corsHeaders(origin?: string): Record<string, string> {
  // Only reflect the origin if it's explicitly allowed.
  // chrome-extension:// origins are allowed (the extension makes these calls).
  // Requests with no origin (e.g. server-to-server) get no ACAO header.
  const isAllowed =
    origin !== undefined &&
    (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('chrome-extension://'));

  return {
    ...(isAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse(
  statusCode: number,
  body: unknown,
  origin?: string,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  };
}
