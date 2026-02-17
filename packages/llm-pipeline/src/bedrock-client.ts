import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Logger, retry } from '@kindwords/utils';

export interface BedrockClientConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private logger: Logger;

  constructor(private config: BedrockClientConfig) {
    this.client = new BedrockRuntimeClient({ region: config.region });
    this.logger = new Logger('BedrockClient');
  }

  async invoke(prompt: string): Promise<string> {
    const payload = {
      messages: [{ role: 'user' as const, content: [{ text: prompt }] }],
      inferenceConfig: {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    };

    return retry(
      async () => {
        this.logger.debug('Invoking Bedrock model', { modelId: this.config.modelId });

        const command = new InvokeModelCommand({
          modelId: this.config.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(payload),
        });

        const response = await this.client.send(command);

        if (!response.body) {
          throw new Error('Bedrock returned empty response body');
        }

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        this.logger.debug('Bedrock response received', {
          inputTokens: responseBody.usage?.inputTokens,
          outputTokens: responseBody.usage?.outputTokens,
        });

        const text = responseBody?.output?.message?.content?.[0]?.text;
        if (typeof text !== 'string') {
          throw new Error(
            `Unexpected Bedrock response structure: ${JSON.stringify(responseBody).slice(0, 200)}`,
          );
        }

        return text;
      },
      { maxAttempts: 3, baseDelayMs: 1000 },
    );
  }
}
