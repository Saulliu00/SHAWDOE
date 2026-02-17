import type { CommentInput, PipelineResult, PipelineOptions, WarmthLevel } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { ToxicityClassifier } from './stages/toxicity-classifier';
import type { EmotionalReframer } from './stages/emotional-reframer';
import type { ResponseSuggester } from './stages/response-suggester';

export class KindWordsPipeline {
  private logger: Logger;

  constructor(
    private classifier: ToxicityClassifier,
    private reframer: EmotionalReframer,
    private suggester: ResponseSuggester,
  ) {
    this.logger = new Logger('KindWordsPipeline');
  }

  async processComment(input: CommentInput, options?: PipelineOptions): Promise<PipelineResult> {
    this.logger.info('Processing single comment', { commentId: input.id });
    const warmth: WarmthLevel = options?.warmth ?? 'medium';

    // Stage 1: Classify
    const classification = await this.classifier.execute(input.text);

    if (!classification.isToxic) {
      return {
        toxicity: classification,
        reframed: null,
        suggestedResponse: null,
        stagesExecuted: ['classify'],
      };
    }

    // Stage 2: Reframe
    const reframed = await this.reframer.execute({
      text: input.text,
      classification,
    }, warmth);

    // Stage 3: Suggest
    const suggestedResponse = await this.suggester.execute({
      original: input.text,
      reframed,
      classification,
    }, warmth);

    return {
      toxicity: classification,
      reframed,
      suggestedResponse,
      stagesExecuted: ['classify', 'reframe', 'suggest'],
    };
  }

  async processBatch(inputs: CommentInput[], options?: PipelineOptions): Promise<PipelineResult[]> {
    this.logger.info('Processing batch', { count: inputs.length });
    const warmth: WarmthLevel = options?.warmth ?? 'medium';

    // Stage 1: Classify all in batch
    const classifications = await this.classifier.executeBatch(
      inputs.map((input) => input.text),
    );

    const results: PipelineResult[] = new Array(inputs.length);
    const toxicIndices: number[] = [];

    for (let i = 0; i < inputs.length; i++) {
      if (classifications[i]?.isToxic) {
        toxicIndices.push(i);
      } else {
        results[i] = {
          toxicity: classifications[i] ?? { isToxic: false, level: 'none', confidence: 0, categories: ['none'] },
          reframed: null,
          suggestedResponse: null,
          stagesExecuted: ['classify'],
        };
      }
    }

    this.logger.info('Classification complete', {
      total: inputs.length,
      toxic: toxicIndices.length,
      clean: inputs.length - toxicIndices.length,
    });

    if (toxicIndices.length === 0) {
      return results;
    }

    // Stage 2: Reframe toxic comments in batch
    const reframeInputs = toxicIndices.map((i) => ({
      text: inputs[i].text,
      classification: classifications[i],
    }));
    const reframed = await this.reframer.executeBatch(reframeInputs, warmth);

    // Stage 3: Suggest responses in batch
    const suggestInputs = toxicIndices.map((i, j) => ({
      original: inputs[i].text,
      reframed: reframed[j],
      classification: classifications[i],
    }));
    const suggestions = await this.suggester.executeBatch(suggestInputs, warmth);

    // Merge results
    for (let j = 0; j < toxicIndices.length; j++) {
      const i = toxicIndices[j];
      results[i] = {
        toxicity: classifications[i],
        reframed: reframed[j],
        suggestedResponse: suggestions[j],
        stagesExecuted: ['classify', 'reframe', 'suggest'],
      };
    }

    return results;
  }
}
