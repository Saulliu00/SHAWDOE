import type { CommentInput, PipelineResult, PipelineOptions, WarmthLevel } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { Rewriter } from './stages/rewriter';

export class KindWordsPipeline {
  private logger: Logger;

  constructor(private rewriter: Rewriter) {
    this.logger = new Logger('KindWordsPipeline');
  }

  async processComment(input: CommentInput, options?: PipelineOptions): Promise<PipelineResult> {
    this.logger.info('Processing single comment', { commentId: input.id });
    const warmth: WarmthLevel = options?.warmth ?? 'medium';

    const result = await this.rewriter.execute(input.text, warmth);

    return {
      reframed: result.reframed,
      suggestedResponse: result.suggestedResponse,
      stagesExecuted: ['rewrite'],
    };
  }

  async processBatch(inputs: CommentInput[], options?: PipelineOptions): Promise<PipelineResult[]> {
    this.logger.info('Processing batch', { count: inputs.length });
    const warmth: WarmthLevel = options?.warmth ?? 'medium';

    const texts = inputs.map((input) => input.text);
    const results = await this.rewriter.executeBatch(texts, warmth);

    return results.map((result) => ({
      reframed: result.reframed,
      suggestedResponse: result.suggestedResponse,
      stagesExecuted: ['rewrite'] as const,
    }));
  }
}
