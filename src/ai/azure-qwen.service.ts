import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export class AzureInferenceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isTransient: boolean = false,
  ) {
    super(message);
    this.name = 'AzureInferenceError';
  }
}

@Injectable()
export class AzureQwenService {
  private readonly logger = new Logger(AzureQwenService.name);

  private getEndpointUrl(): string {
    const url = process.env.AZURE_QWEN_ENDPOINT_URL || process.env.AZURE_ML_ENDPOINT_URL;
    if (!url) {
      throw new AzureInferenceError(
        'AZURE_QWEN_ENDPOINT_URL (or AZURE_ML_ENDPOINT_URL) is not configured in environment',
        500,
        false,
      );
    }
    return url.trim();
  }

  private getApiKey(): string {
    const key = process.env.AZURE_QWEN_API_KEY || process.env.AZURE_ML_API_KEY;
    if (!key) {
      throw new AzureInferenceError(
        'AZURE_QWEN_API_KEY (or AZURE_ML_API_KEY) is not configured in environment',
        500,
        false,
      );
    }
    return key.trim();
  }

  async generateText(prompt: string, maxTokens: number = 256): Promise<string> {
    const endpoint = this.getEndpointUrl();
    const apiKey = this.getApiKey();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const payload = {
      prompt,
      max_new_tokens: maxTokens,
      temperature: 0.7,
    };

    const timeoutMs = Math.max(
      30_000,
      parseInt(process.env.AZURE_INFERENCE_TIMEOUT_MS || '180000', 10) || 180_000,
    );

    try {
      this.logger.log(`Calling Azure ML Qwen endpoint (${endpoint.slice(0, 45)}...) [timeout=${timeoutMs}ms maxTokens=${maxTokens}]`);
      const response = await axios.post(endpoint, payload, {
        headers,
        timeout: timeoutMs,
      });

      if (!response.data) {
        throw new AzureInferenceError('Empty response from Azure ML endpoint', 502, true);
      }

      const data = response.data;
      if (typeof data === 'object' && data !== null && (data as any).error) {
        throw new AzureInferenceError(`Azure ML returned error: ${(data as any).error}`, 502, true);
      }

      let text = '';
      if (typeof data === 'string') {
        text = data;
      } else if (Array.isArray(data)) {
        const first = data[0];
        text = typeof first === 'string' ? first : first?.generated_text || first?.text || JSON.stringify(first);
      } else if (typeof data === 'object' && data !== null) {
        if (typeof (data as any).response === 'string') {
          text = (data as any).response;
        } else if (Array.isArray((data as any).choices) && (data as any).choices.length > 0) {
          const choice = (data as any).choices[0];
          text = choice.message?.content || choice.text || JSON.stringify(choice);
        } else if (typeof (data as any).generated_text === 'string') {
          text = (data as any).generated_text;
        } else if (typeof (data as any).output === 'string') {
          text = (data as any).output;
        } else {
          text = JSON.stringify(data);
        }
      }

      if (!text || text.trim().length === 0) {
        throw new AzureInferenceError('Model returned blank/empty text response', 502, true);
      }

      return text;
    } catch (err: any) {
      if (err instanceof AzureInferenceError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseBody = typeof err.response?.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response?.data || {});

        this.logger.error(
          `Azure ML request failed: HTTP ${status || 'ERR'} - ${err.message}`,
        );

        if (status === 429) {
          throw new AzureInferenceError(
            'Azure ML rate limit reached (429)',
            429,
            true,
          );
        }

        if (status && status >= 500) {
          throw new AzureInferenceError(
            `Azure ML server error (${status}): ${responseBody.slice(0, 200)}`,
            status,
            true,
          );
        }

        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
          throw new AzureInferenceError(`Azure ML request timed out after ${Math.round(timeoutMs / 1000)}s`, 504, true);
        }

        if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || !err.response) {
          throw new AzureInferenceError(`Azure ML network connection failure: ${err.message}`, 503, true);
        }

        throw new AzureInferenceError(
          `Azure ML client error (${status}): ${responseBody.slice(0, 200)}`,
          status,
          false,
        );
      }

      this.logger.error(`Unexpected error during Azure ML inference: ${err.message}`);
      throw new AzureInferenceError(`Inference failed: ${err.message}`, 500, true);
    }
  }
}
