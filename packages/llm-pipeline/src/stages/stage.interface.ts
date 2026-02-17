import type { PipelineStageName } from '@kindwords/types';

export interface PipelineStageHandler<TInput, TOutput> {
  readonly name: PipelineStageName;
  execute(input: TInput): Promise<TOutput>;
  executeBatch(inputs: TInput[]): Promise<TOutput[]>;
}
