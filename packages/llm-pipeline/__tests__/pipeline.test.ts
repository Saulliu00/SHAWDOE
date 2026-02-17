import { describe, it, expect, vi } from 'vitest';
import { KindWordsPipeline } from '../src/pipeline';
import type { ToxicityClassifier } from '../src/stages/toxicity-classifier';
import type { EmotionalReframer } from '../src/stages/emotional-reframer';
import type { ResponseSuggester } from '../src/stages/response-suggester';

function createMockPipeline(toxicIndices: number[] = []) {
  const classifier = {
    name: 'classify',
    execute: vi.fn(),
    executeBatch: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(
        texts.map((_, i) => ({
          isToxic: toxicIndices.includes(i),
          level: toxicIndices.includes(i) ? 'moderate' : 'none',
          confidence: 0.9,
          categories: toxicIndices.includes(i) ? ['insult'] : ['none'],
        })),
      ),
    ),
  } as unknown as ToxicityClassifier;

  const reframer = {
    name: 'reframe',
    execute: vi.fn(),
    executeBatch: vi.fn().mockImplementation((inputs: unknown[]) =>
      Promise.resolve(inputs.map(() => 'A kinder version of this comment')),
    ),
  } as unknown as EmotionalReframer;

  const suggester = {
    name: 'suggest',
    execute: vi.fn(),
    executeBatch: vi.fn().mockImplementation((inputs: unknown[]) =>
      Promise.resolve(inputs.map(() => 'A kind reply suggestion')),
    ),
  } as unknown as ResponseSuggester;

  return { pipeline: new KindWordsPipeline(classifier, reframer, suggester), classifier, reframer, suggester };
}

describe('KindWordsPipeline', () => {
  it('short-circuits non-toxic comments (skips reframe + suggest)', async () => {
    const { pipeline, reframer, suggester } = createMockPipeline([]);

    const results = await pipeline.processBatch([
      { id: '1', text: 'nice video' },
      { id: '2', text: 'thanks for sharing' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].reframed).toBeNull();
    expect(results[0].stagesExecuted).toEqual(['classify']);
    expect(reframer.executeBatch).not.toHaveBeenCalled();
    expect(suggester.executeBatch).not.toHaveBeenCalled();
  });

  it('processes toxic comments through all 3 stages', async () => {
    const { pipeline, reframer, suggester } = createMockPipeline([0]);

    const results = await pipeline.processBatch([
      { id: '1', text: 'toxic comment' },
      { id: '2', text: 'nice comment' },
    ]);

    expect(results).toHaveLength(2);

    // Toxic comment: all 3 stages
    expect(results[0].toxicity.isToxic).toBe(true);
    expect(results[0].reframed).toBe('A kinder version of this comment');
    expect(results[0].suggestedResponse).toBe('A kind reply suggestion');
    expect(results[0].stagesExecuted).toEqual(['classify', 'reframe', 'suggest']);

    // Clean comment: only classify
    expect(results[1].toxicity.isToxic).toBe(false);
    expect(results[1].reframed).toBeNull();
    expect(results[1].stagesExecuted).toEqual(['classify']);

    expect(reframer.executeBatch).toHaveBeenCalledTimes(1);
    expect(suggester.executeBatch).toHaveBeenCalledTimes(1);
  });

  it('handles single comment processing', async () => {
    const classifier = {
      name: 'classify',
      execute: vi.fn().mockResolvedValue({
        isToxic: true,
        level: 'mild',
        confidence: 0.7,
        categories: ['sarcasm_hostile'],
      }),
      executeBatch: vi.fn(),
    } as unknown as ToxicityClassifier;

    const reframer = {
      name: 'reframe',
      execute: vi.fn().mockResolvedValue('Kinder version'),
      executeBatch: vi.fn(),
    } as unknown as EmotionalReframer;

    const suggester = {
      name: 'suggest',
      execute: vi.fn().mockResolvedValue('Kind reply'),
      executeBatch: vi.fn(),
    } as unknown as ResponseSuggester;

    const pipeline = new KindWordsPipeline(classifier, reframer, suggester);
    const result = await pipeline.processComment({ id: '1', text: 'snarky comment' });

    expect(result.toxicity.isToxic).toBe(true);
    expect(result.reframed).toBe('Kinder version');
    expect(result.suggestedResponse).toBe('Kind reply');
  });
});
