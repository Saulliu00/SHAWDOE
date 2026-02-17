import type { ToxicityClassification } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { BedrockClient } from '../bedrock-client';
import { buildClassifyPrompt, buildBatchClassifyPrompt } from '../prompts/classify.prompt';
import type { PipelineStageHandler } from './stage.interface';

export class ToxicityClassifier implements PipelineStageHandler<string, ToxicityClassification> {
  readonly name = 'classify' as const;
  private logger: Logger;

  constructor(private bedrockClient: BedrockClient) {
    this.logger = new Logger('ToxicityClassifier');
  }

  async execute(text: string): Promise<ToxicityClassification> {
    const prompt = buildClassifyPrompt(text);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseResponse(response);
  }

  async executeBatch(texts: string[]): Promise<ToxicityClassification[]> {
    if (texts.length === 1) {
      return [await this.execute(texts[0])];
    }

    const prompt = buildBatchClassifyPrompt(texts);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseBatchResponse(response, texts.length);
  }

  private parseResponse(raw: string): ToxicityClassification {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isToxic: Boolean(parsed.isToxic),
        level: parsed.level ?? 'none',
        confidence: Number(parsed.confidence) || 0,
        categories: Array.isArray(parsed.categories) ? parsed.categories : ['none'],
      };
    } catch (error) {
      this.logger.error('Failed to parse classification response', { raw, error: String(error) });
      return { isToxic: false, level: 'none', confidence: 0, categories: ['none'] };
    }
  }

  private parseBatchResponse(raw: string, expectedCount: number): ToxicityClassification[] {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed = JSON.parse(jsonMatch[0]) as ToxicityClassification[];
      if (parsed.length !== expectedCount) {
        this.logger.warn('Batch response count mismatch', {
          expected: expectedCount,
          received: parsed.length,
        });
      }

      return parsed.map((item) => ({
        isToxic: Boolean(item.isToxic),
        level: item.level ?? 'none',
        confidence: Number(item.confidence) || 0,
        categories: Array.isArray(item.categories) ? item.categories : ['none'],
      }));
    } catch (error) {
      this.logger.error('Failed to parse batch classification', { raw, error: String(error) });
      return Array(expectedCount).fill({
        isToxic: false,
        level: 'none',
        confidence: 0,
        categories: ['none'],
      });
    }
  }
}
