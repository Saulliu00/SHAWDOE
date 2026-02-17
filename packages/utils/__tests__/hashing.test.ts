import { describe, it, expect } from 'vitest';
import { hashContent } from '../src/hashing';

describe('hashContent', () => {
  it('produces consistent SHA-256 hash', () => {
    const hash1 = hashContent('hello world');
    const hash2 = hashContent('hello world');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashContent('hello');
    const hash2 = hashContent('world');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 64-character hex string', () => {
    const hash = hashContent('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});
