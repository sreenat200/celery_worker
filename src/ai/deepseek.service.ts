import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export class DeepSeekInferenceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isTransient: boolean = false,
  ) {
    super(message);
    this.name = 'DeepSeekInferenceError';
  }
}

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);

  getEndpointUrl(): string {
    const url = process.env.DEEPSEEK_ENDPOINT_URL || 'https://api.deepseek.com/chat/completions';
    return url.trim();
  }

  getApiKey(): string {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new DeepSeekInferenceError(
        'DEEPSEEK_API_KEY is not configured in environment',
        500,
        false,
      );
    }
    return key.trim();
  }

  getModel(): string {
    return (process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash').trim();
  }

  /**
   * Generates text / JSON completion using DeepSeek Chat Completions API.
   */
  async generateChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      jsonMode?: boolean;
      disableThinking?: boolean;
    },
  ): Promise<string> {
    const endpoint = this.getEndpointUrl();
    const apiKey = this.getApiKey();
    const model = options?.model || this.getModel();
    const resolvedMaxTokens = options?.maxTokens ?? (parseInt(process.env.DEEPSEEK_MAX_TOKENS || '4096', 10) || 4096);
    const temperature = options?.temperature ?? 0.7;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const timeoutMs = Math.max(
      30_000,
      parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '120000', 10) || 120_000,
    );

    const payload: Record<string, any> = {
      model,
      messages,
      temperature,
      max_tokens: resolvedMaxTokens,
    };

    if (options?.jsonMode !== false) {
      payload.response_format = { type: 'json_object' };
    }
    if (options?.disableThinking !== false) {
      payload.thinking = { type: 'disabled' };
    }

    try {
      this.logger.log(`Calling DeepSeek API [model=${model} maxTokens=${resolvedMaxTokens} timeout=${timeoutMs}ms]`);
      
      let response;
      try {
        response = await axios.post(endpoint, payload, {
          headers,
          timeout: timeoutMs,
        });
      } catch (postErr: any) {
        if (axios.isAxiosError(postErr) && postErr.response?.status === 400) {
          const body = JSON.stringify(postErr.response?.data || {});
          if (payload.thinking && body.toLowerCase().includes('thinking')) {
            this.logger.warn(`Model ${model} rejected thinking=disabled. Retrying without thinking flag.`);
            delete payload.thinking;
            response = await axios.post(endpoint, payload, { headers, timeout: timeoutMs });
          } else if (payload.response_format && body.includes('response_format')) {
            this.logger.warn(`Model ${model} rejected response_format: json_object. Retrying without format constraint.`);
            delete payload.response_format;
            response = await axios.post(endpoint, payload, { headers, timeout: timeoutMs });
          } else {
            throw postErr;
          }
        } else {
          throw postErr;
        }
      }

      if (!response?.data) {
        throw new DeepSeekInferenceError('Empty response from DeepSeek API', 502, true);
      }

      const data = response.data;
      if (typeof data === 'object' && data !== null && (data as any).error) {
        throw new DeepSeekInferenceError(`DeepSeek returned error: ${(data as any).error?.message || JSON.stringify((data as any).error)}`, 502, true);
      }

      const choice = data?.choices?.[0];
      const content = String(choice?.message?.content || choice?.text || '').trim();
      const reasoning = String(choice?.message?.reasoning_content || '').trim();
      const finishReason = String(choice?.finish_reason || '');

      const usage = data?.usage || {};
      this.logger.log(
        `DeepSeek ok model=${model} prompt_tokens=${usage.prompt_tokens || 0} completion_tokens=${usage.completion_tokens || 0} total_tokens=${usage.total_tokens || 0}`,
      );

      if (content) {
        return content;
      }

      if (reasoning && /\{[\s\S]*"layout"[\s\S]*\}/.test(reasoning)) {
        this.logger.warn('Model returned JSON only inside reasoning_content; extracting that object.');
        return reasoning;
      }

      if (reasoning || finishReason === 'length') {
        throw new DeepSeekInferenceError(
          'DeepSeek used the token budget on reasoning and returned no JSON. Retrying.',
          502,
          true,
        );
      }

      this.logger.warn(`DeepSeek returned empty content. Raw response: ${JSON.stringify(data).slice(0, 300)}`);
      throw new DeepSeekInferenceError('DeepSeek model returned blank/empty text response', 502, true);
    } catch (err: any) {
      if (err instanceof DeepSeekInferenceError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseBody = typeof err.response?.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response?.data || {});

        this.logger.error(
          `DeepSeek API request failed: HTTP ${status || 'ERR'} code=${(err.response?.data as any)?.error?.code || 'n/a'}`,
        );

        if (status === 401) {
          throw new DeepSeekInferenceError(
            'DeepSeek API authentication failed (401). Please verify DEEPSEEK_API_KEY.',
            401,
            false,
          );
        }

        if (status === 429) {
          throw new DeepSeekInferenceError(
            'DeepSeek API rate limit reached (429)',
            429,
            true,
          );
        }

        if (status && status >= 500) {
          throw new DeepSeekInferenceError(
            `DeepSeek server error (HTTP ${status}): ${err.message}`,
            status,
            true,
          );
        }

        throw new DeepSeekInferenceError(
          `DeepSeek API request failed (HTTP ${status || 'ERR'}): ${err.message}`,
          status || 500,
          false,
        );
      }

      this.logger.error(`Unexpected DeepSeek error: ${err.message}`);
      throw new DeepSeekInferenceError(err.message, 500, false);
    }
  }

  /**
   * Convenience helper for single prompt text generation.
   */
  async generateText(
    prompt: string,
    maxTokens?: number,
    systemPrompt?: string,
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (systemPrompt && systemPrompt.trim().length > 0) {
      messages.push({ role: 'system', content: systemPrompt.trim() });
    }

    messages.push({ role: 'user', content: prompt.trim() });

    return this.generateChat(messages, { maxTokens });
  }
}
