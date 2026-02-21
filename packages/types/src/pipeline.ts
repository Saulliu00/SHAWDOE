import type { WarmthLevel } from './comment';

export type PipelineStageName = 'rewrite';

export interface PipelineOptions {
  warmth?: WarmthLevel;
}

export interface PipelineResult {
  reframed: string;
  suggestedResponse: string;
  stagesExecuted: PipelineStageName[];
}
