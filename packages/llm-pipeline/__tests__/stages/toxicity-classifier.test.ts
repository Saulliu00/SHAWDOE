import { describe, it, expect, vi } from 'vitest';
import { ToxicityClassifier } from '../../src/stages/toxicity-classifier';
import type { BedrockClient } from '../../src/bedrock-client';

function mockBedrockClient(response: string): BedrockClient {
  return {
    invoke: vi.fn().mockResolvedValue(response),
  } as unknown as BedrockClient;
}

describe('ToxicityClassifier', () => {
  it('classifies toxic comment correctly', async () => {
    const bedrockResponse = JSON.stringify({
      isToxic: true,
      level: 'severe',
      confidence: 0.95,
      categories: ['insult', 'harassment'],
    });

    const classifier = new ToxicityClassifier(mockBedrockClient(bedrockResponse));
    const result = await classifier.execute('you are terrible');

    expect(result.isToxic).toBe(true);
    expect(result.level).toBe('severe');
    expect(result.confidence).toBe(0.95);
    expect(result.categories).toContain('insult');
  });

  it('classifies benign comment as non-toxic', async () => {
    const bedrockResponse = JSON.stringify({
      isToxic: false,
      level: 'none',
      confidence: 0.98,
      categories: ['none'],
    });

    const classifier = new ToxicityClassifier(mockBedrockClient(bedrockResponse));
    const result = await classifier.execute('great video, thanks for sharing!');

    expect(result.isToxic).toBe(false);
    expect(result.level).toBe('none');
  });

  it('handles malformed response gracefully', async () => {
    const classifier = new ToxicityClassifier(mockBedrockClient('invalid json response'));
    const result = await classifier.execute('test');

    expect(result.isToxic).toBe(false);
    expect(result.level).toBe('none');
  });

  it('processes batch classification', async () => {
    const batchResponse = JSON.stringify([
      { isToxic: true, level: 'moderate', confidence: 0.8, categories: ['insult'] },
      { isToxic: false, level: 'none', confidence: 0.95, categories: ['none'] },
    ]);

    const classifier = new ToxicityClassifier(mockBedrockClient(batchResponse));
    const results = await classifier.executeBatch(['toxic comment', 'nice comment']);

    expect(results).toHaveLength(2);
    expect(results[0].isToxic).toBe(true);
    expect(results[1].isToxic).toBe(false);
  });
});
