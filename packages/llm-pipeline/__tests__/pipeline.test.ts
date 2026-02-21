import { describe, it, expect, vi } from 'vitest';
import { KindWordsPipeline } from '../src/pipeline';
import type { Rewriter } from '../src/stages/rewriter';

function createMockPipeline() {
  const rewriter = {
    name: 'rewrite',
    execute: vi.fn().mockResolvedValue({
      reframed: 'A kinder version of this comment',
      suggestedResponse: 'A kind reply suggestion',
    }),
    executeBatch: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(
        texts.map(() => ({
          reframed: 'A kinder version of this comment',
          suggestedResponse: 'A kind reply suggestion',
        })),
      ),
    ),
  } as unknown as Rewriter;

  return { pipeline: new KindWordsPipeline(rewriter), rewriter };
}

describe('KindWordsPipeline', () => {
  it('rewrites all comments in a batch', async () => {
    const { pipeline, rewriter } = createMockPipeline();

    const results = await pipeline.processBatch([
      { id: '1', text: 'nice video' },
      { id: '2', text: 'thanks for sharing' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].reframed).toBe('A kinder version of this comment');
    expect(results[0].suggestedResponse).toBe('A kind reply suggestion');
    expect(results[0].stagesExecuted).toEqual(['rewrite']);
    expect(results[1].reframed).toBe('A kinder version of this comment');
    expect(rewriter.executeBatch).toHaveBeenCalledTimes(1);
  });

  it('handles single comment processing', async () => {
    const { pipeline } = createMockPipeline();
    const result = await pipeline.processComment({ id: '1', text: 'some comment' });

    expect(result.reframed).toBe('A kinder version of this comment');
    expect(result.suggestedResponse).toBe('A kind reply suggestion');
    expect(result.stagesExecuted).toEqual(['rewrite']);
  });

  it('passes warmth option to rewriter', async () => {
    const { pipeline, rewriter } = createMockPipeline();
    await pipeline.processBatch(
      [{ id: '1', text: 'test' }],
      { warmth: 'high' },
    );

    expect(rewriter.executeBatch).toHaveBeenCalledWith(['test'], 'high');
  });
});
