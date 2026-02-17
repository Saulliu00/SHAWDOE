import type { ToxicityClassification, WarmthLevel } from './comment';

export type PipelineStageName = 'classify' | 'reframe' | 'suggest';

export interface PipelineOptions {
  warmth?: WarmthLevel;
}

export interface PipelineResult {
  toxicity: ToxicityClassification;
  reframed: string | null;
  suggestedResponse: string | null;
  stagesExecuted: PipelineStageName[];
}

export interface PipelineStage<TInput, TOutput> {
  readonly name: PipelineStageName;
  execute(input: TInput): Promise<TOutput>;
  executeBatch(inputs: TInput[]): Promise<TOutput[]>;
}

export interface ReframeInput {
  text: string;
  classification: ToxicityClassification;
}

export interface SuggestInput {
  original: string;
  reframed: string;
  classification: ToxicityClassification;
}
