import type { ToxicityClassification, WarmthLevel } from '@kindwords/types';
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

  async execute(input: SuggestInput, warmth: WarmthLevel = 'medium'): Promise<string> {
    const prompt = buildSuggestPrompt(input.original, input.reframed, input.classification, warmth);
    const response = await this.bedrockClient.invoke(prompt);
    return response.trim().replace(/^["']|["']$/g, '');
  }

  async executeBatch(inputs: SuggestInput[], warmth: WarmthLevel = 'medium'): Promise<string[]> {
    if (inputs.length === 1) {
      return [await this.execute(inputs[0], warmth)];
    }

    const prompt = buildBatchSuggestPrompt(inputs, warmth);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseBatchResponse(response, inputs.length);
  }

  private parseBatchResponse(raw: string, expectedCount: number): string[] {
    try {
      // Extract JSON from markdown code blocks if present (e.g. ```json ... ```)
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw;
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed = JSON.parse(jsonMatch[0]) as string[];
      // Pad or truncate to match expected count
      while (parsed.length < expectedCount) {
        parsed.push('[Unable to suggest response]');
      }

      return parsed.slice(0, expectedCount).map((s) => String(s).trim());
    } catch (error) {
      this.logger.error('Failed to parse batch suggest', { raw, error: String(error) });
      return Array.from({ length: expectedCount }, () => '[Unable to suggest response]');
    }
  }
}
