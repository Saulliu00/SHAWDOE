import type { ToxicityClassification } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { BedrockClient } from '../bedrock-client';
import { buildReframePrompt, buildBatchReframePrompt } from '../prompts/reframe.prompt';
import type { PipelineStageHandler } from './stage.interface';

export interface ReframeInput {
  text: string;
  classification: ToxicityClassification;
}

export class EmotionalReframer
  implements PipelineStageHandler<ReframeInput, string>
{
  readonly name = 'reframe' as const;
  private logger: Logger;

  constructor(private bedrockClient: BedrockClient) {
    this.logger = new Logger('EmotionalReframer');
  }

  async execute(input: ReframeInput): Promise<string> {
    const prompt = buildReframePrompt(input.text, input.classification);
    const response = await this.bedrockClient.invoke(prompt);
    return response.trim().replace(/^["']|["']$/g, '');
  }

  async executeBatch(inputs: ReframeInput[]): Promise<string[]> {
    if (inputs.length === 1) {
      return [await this.execute(inputs[0])];
    }

    const prompt = buildBatchReframePrompt(inputs);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseBatchResponse(response, inputs.length);
  }

  private parseBatchResponse(raw: string, expectedCount: number): string[] {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed = JSON.parse(jsonMatch[0]) as string[];
      if (parsed.length !== expectedCount) {
        this.logger.warn('Batch reframe count mismatch', {
          expected: expectedCount,
          received: parsed.length,
        });
      }

      return parsed.map((s) => String(s).trim());
    } catch (error) {
      this.logger.error('Failed to parse batch reframe', { raw, error: String(error) });
      return Array(expectedCount).fill('[Unable to reframe]');
    }
  }
}
