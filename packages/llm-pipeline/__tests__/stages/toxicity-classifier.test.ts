import { describe, it, expect, vi } from 'vitest';
import { Rewriter } from '../../src/stages/rewriter';
import type { BedrockClient } from '../../src/bedrock-client';

function mockBedrockClient(response: string): BedrockClient {
  return {
    invoke: vi.fn().mockResolvedValue(response),
  } as unknown as BedrockClient;
}

describe('Rewriter', () => {
  it('rewrites a single comment with reframed text and suggestion', async () => {
    const bedrockResponse = JSON.stringify({
      reframed: 'I respectfully disagree with the content here.',
      suggestedResponse: 'Thanks for sharing your perspective!',
    });

    const rewriter = new Rewriter(mockBedrockClient(bedrockResponse));
    const result = await rewriter.execute('this video is garbage');

    expect(result.reframed).toBe('I respectfully disagree with the content here.');
    expect(result.suggestedResponse).toBe('Thanks for sharing your perspective!');
  });

  it('handles malformed single response gracefully', async () => {
    const rewriter = new Rewriter(mockBedrockClient('invalid json response'));
    const result = await rewriter.execute('test comment');

    expect(result.reframed).toBe('test comment');
    expect(result.suggestedResponse).toBe('');
  });

  it('processes batch rewrite', async () => {
    const batchResponse = JSON.stringify([
      { reframed: 'Kind version 1', suggestedResponse: 'Reply 1' },
      { reframed: 'Kind version 2', suggestedResponse: 'Reply 2' },
    ]);

    const rewriter = new Rewriter(mockBedrockClient(batchResponse));
    const results = await rewriter.executeBatch(['toxic 1', 'toxic 2']);

    expect(results).toHaveLength(2);
    expect(results[0].reframed).toBe('Kind version 1');
    expect(results[1].suggestedResponse).toBe('Reply 2');
  });

  it('pads batch response when LLM returns fewer results', async () => {
    const batchResponse = JSON.stringify([
      { reframed: 'Kind version 1', suggestedResponse: 'Reply 1' },
    ]);

    const rewriter = new Rewriter(mockBedrockClient(batchResponse));
    const results = await rewriter.executeBatch(['comment 1', 'comment 2']);

    expect(results).toHaveLength(2);
    expect(results[0].reframed).toBe('Kind version 1');
    expect(results[1].reframed).toBe('comment 2'); // Falls back to original text
  });

  it('handles code block wrapped JSON response', async () => {
    const bedrockResponse = '```json\n{"reframed": "Nice version", "suggestedResponse": "Thanks!"}\n```';

    const rewriter = new Rewriter(mockBedrockClient(bedrockResponse));
    const result = await rewriter.execute('mean comment');

    expect(result.reframed).toBe('Nice version');
    expect(result.suggestedResponse).toBe('Thanks!');
  });
});
