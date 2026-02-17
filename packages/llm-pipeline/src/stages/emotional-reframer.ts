import type { ToxicityClassification, WarmthLevel } from '@kindwords/types';
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

  async execute(input: ReframeInput, warmth: WarmthLevel = 'medium'): Promise<string> {
    const prompt = buildReframePrompt(input.text, input.classification, warmth);
    const response = await this.bedrockClient.invoke(prompt);
    return response.trim().replace(/^["']|["']$/g, '');
  }

  async executeBatch(inputs: ReframeInput[], warmth: WarmthLevel = 'medium'): Promise<string[]> {
    if (inputs.length === 1) {
      return [await this.execute(inputs[0], warmth)];
    }

    const prompt = buildBatchReframePrompt(inputs, warmth);
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
        parsed.push('[Unable to reframe]');
      }

      return parsed.slice(0, expectedCount).map((s) => String(s).trim());
    } catch (error) {
      this.logger.error('Failed to parse batch reframe', { raw, error: String(error) });
      return Array.from({ length: expectedCount }, () => '[Unable to reframe]');
    }
  }
}
