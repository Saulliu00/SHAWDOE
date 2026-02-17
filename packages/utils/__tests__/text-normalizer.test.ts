import { describe, it, expect } from 'vitest';
import { normalizeText, truncateText } from '../src/text-normalizer';

describe('normalizeText', () => {
  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('lowercases text', () => {
    expect(normalizeText('HELLO World')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('handles mixed whitespace', () => {
    expect(normalizeText('  hello \t world  \n  ')).toBe('hello world');
  });
});

describe('truncateText', () => {
  it('returns text unchanged if under limit', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates text over limit', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('uses default limit of 500', () => {
    const longText = 'a'.repeat(600);
    const result = truncateText(longText);
    expect(result.length).toBe(503); // 500 + '...'
  });
});
