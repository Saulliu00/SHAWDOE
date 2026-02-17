import type { ToxicityClassification } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { BedrockClient } from '../bedrock-client';
import { buildSuggestPrompt, buildBatchSuggestPrompt } from '../prompts/suggest.prompt';
import type { PipelineStageHandler } from './stage.interface';

export interface SuggestInput {
  original: string;
  reframed: string;
  classification: ToxicityClassification;
}

export class ResponseSuggester
  implements PipelineStageHandler<SuggestInput, string>
{
  readonly name = 'suggest' as const;
  private logger: Logger;

  constructor(private bedrockClient: BedrockClient) {
    this.logger = new Logger('ResponseSuggester');
  }

  async execute(input: SuggestInput): Promise<string> {
    const prompt = buildSuggestPrompt(input.original, input.reframed, input.classification);
    const response = await this.bedrockClient.invoke(prompt);
    return response.trim().replace(/^["']|["']$/g, '');
  }

  async executeBatch(inputs: SuggestInput[]): Promise<string[]> {
    if (inputs.length === 1) {
      return [await this.execute(inputs[0])];
    }

    const prompt = buildBatchSuggestPrompt(inputs);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseBatchResponse(response, inputs.length);
  }

  private parseBatchResponse(raw: string, expectedCount: number): string[] {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed = JSON.parse(jsonMatch[0]) as string[];
      if (parsed.length !== expectedCount) {
        this.logger.warn('Batch suggest count mismatch', {
          expected: expectedCount,
          received: parsed.length,
        });
      }

      return parsed.map((s) => String(s).trim());
    } catch (error) {
      this.logger.error('Failed to parse batch suggest', { raw, error: String(error) });
      return Array(expectedCount).fill('[Unable to suggest response]');
    }
  }
}
