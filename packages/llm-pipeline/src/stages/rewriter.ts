import type { WarmthLevel } from '@kindwords/types';
import { Logger } from '@kindwords/utils';
import type { BedrockClient } from '../bedrock-client';
import { buildRewritePrompt, buildBatchRewritePrompt } from '../prompts/rewrite.prompt';

export interface RewriteResult {
  reframed: string;
  suggestedResponse: string;
}

export class Rewriter {
  readonly name = 'rewrite' as const;
  private logger: Logger;

  constructor(private bedrockClient: BedrockClient) {
    this.logger = new Logger('Rewriter');
  }

  async execute(text: string, warmth: WarmthLevel = 'medium'): Promise<RewriteResult> {
    const prompt = buildRewritePrompt(text, warmth);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseSingleResponse(response, text);
  }

  async executeBatch(texts: string[], warmth: WarmthLevel = 'medium'): Promise<RewriteResult[]> {
    if (texts.length === 1) {
      return [await this.execute(texts[0], warmth)];
    }

    const prompt = buildBatchRewritePrompt(texts, warmth);
    const response = await this.bedrockClient.invoke(prompt);
    return this.parseBatchResponse(response, texts.length, texts);
  }

  private parseSingleResponse(raw: string, originalText: string): RewriteResult {
    try {
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw;
      const parsed = JSON.parse(jsonStr) as { reframed?: string; suggestedResponse?: string };

      return {
        reframed: parsed.reframed?.trim() ?? originalText,
        suggestedResponse: parsed.suggestedResponse?.trim() ?? '',
      };
    } catch (error) {
      this.logger.error('Failed to parse single rewrite response', { raw, error: String(error) });
      return { reframed: originalText, suggestedResponse: '' };
    }
  }

  private parseBatchResponse(raw: string, expectedCount: number, originalTexts: string[]): RewriteResult[] {
    try {
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw;
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ reframed?: string; suggestedResponse?: string }>;

      const results: RewriteResult[] = parsed.map((item, i) => ({
        reframed: item.reframed?.trim() ?? originalTexts[i] ?? '',
        suggestedResponse: item.suggestedResponse?.trim() ?? '',
      }));

      // Pad if LLM returned fewer results
      while (results.length < expectedCount) {
        const i = results.length;
        results.push({ reframed: originalTexts[i] ?? '', suggestedResponse: '' });
      }

      return results.slice(0, expectedCount);
    } catch (error) {
      this.logger.error('Failed to parse batch rewrite response', { raw, error: String(error) });
      return Array.from({ length: expectedCount }, (_, i) => ({
        reframed: originalTexts[i] ?? '',
        suggestedResponse: '',
      }));
    }
  }
}
