import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCommentsSchema, validateRequest } from '../../src/middleware/validator';

describe('processCommentsSchema validation', () => {
  it('accepts valid request', () => {
    const result = validateRequest(processCommentsSchema, {
      comments: [{ id: '1', text: 'hello world' }],
      platform: 'youtube',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty comments array', () => {
    const result = validateRequest(processCommentsSchema, {
      comments: [],
      platform: 'youtube',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects too many comments', () => {
    const comments = Array.from({ length: 26 }, (_, i) => ({
      id: String(i),
      text: `comment ${i}`,
    }));

    const result = validateRequest(processCommentsSchema, {
      comments,
      platform: 'youtube',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid platform', () => {
    const result = validateRequest(processCommentsSchema, {
      comments: [{ id: '1', text: 'hello' }],
      platform: 'facebook',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid client ID format', () => {
    const result = validateRequest(processCommentsSchema, {
      comments: [{ id: '1', text: 'hello' }],
      platform: 'youtube',
      clientId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('accepts optional context fields', () => {
    const result = validateRequest(processCommentsSchema, {
      comments: [{ id: '1', text: 'hello' }],
      platform: 'youtube',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      context: { videoId: 'dQw4w9WgXcQ' },
    });

    expect(result.success).toBe(true);
  });
});
