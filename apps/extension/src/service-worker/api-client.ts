import type { ProcessCommentsResponse, ProcessBatchPayload } from '@kindwords/types';
import { getClientId } from '../shared/storage';
import { DEFAULT_CONFIG } from '../shared/constants';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_CONFIG.apiBaseUrl;
  }

  async processComments(
    payload: ProcessBatchPayload,
  ): Promise<ProcessCommentsResponse> {
    const clientId = await getClientId();

    const response = await fetch(`${this.baseUrl}/comments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comments: payload.comments,
        platform: payload.platform,
        context: payload.context,
        warmth: payload.warmth,
        clientId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `API error ${response.status}: ${(errorBody as { error?: { message?: string } }).error?.message ?? 'Unknown'}`,
      );
    }

    return response.json();
  }

  async checkStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
