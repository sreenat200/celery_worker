import { Injectable, Logger } from '@nestjs/common';
import type { AiGenerationResult } from '../jobs/bullmq.constants';

export class AiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiValidationError';
  }
}

@Injectable()
export class AiResponseValidator {
  private readonly logger = new Logger(AiResponseValidator.name);

  validateAndExtract(rawText: string, context: 'product' | 'collection'): AiGenerationResult {
    if (!rawText || typeof rawText !== 'string') {
      throw new AiValidationError('Raw model output is empty or not a string');
    }

    const trimmed = rawText.trim();
    let jsonString = trimmed;

    // 1. Check for markdown code blocks
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonString = codeBlockMatch[1].trim();
    } else {
      // 2. Extract first {...} object
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = trimmed.slice(firstBrace, lastBrace + 1).trim();
      }
    }

    // 3. Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err: any) {
      if (trimmed.length > 20 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        this.logger.warn(`Model returned plain text rather than JSON; extracting direct text.`);
        parsed = { description: trimmed.replace(/^"|"$/g, '').trim() };
      } else {
        this.logger.error(`Failed to parse model JSON: ${jsonString.slice(0, 150)}`);
        throw new AiValidationError(`Model output is not valid JSON: ${err.message}`);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new AiValidationError('Model output JSON root must be an object');
    }

    let description: string | undefined =
      parsed.description || parsed.product_description || parsed.collection_description;

    if (typeof description !== 'string') {
      throw new AiValidationError('Field "description" is missing or not a string in model output');
    }

    description = description.replace(/^["']|["']$/g, '').replace(/\r\n/g, '\n').trim();

    if (description.length < 15) {
      throw new AiValidationError(`Generated description is too short (${description.length} chars)`);
    }

    const words = description.split(/\s+/).filter(Boolean);
    if (context === 'product' && words.length < 20) {
      this.logger.warn(`Product description is on the shorter side (${words.length} words): "${description}"`);
    }

    return {
      description,
    };
  }
}
