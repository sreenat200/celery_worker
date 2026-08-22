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

  validateAndExtract(rawText: string, _context: 'product' | 'collection'): AiGenerationResult {
    if (!rawText || typeof rawText !== 'string') {
      throw new AiValidationError('Raw model output is empty or not a string');
    }

    let text = rawText.trim();

    // 1. Look for explicit JSON: {"description": "..."}
    const jsonDescMatch = text.match(/"(?:product_)?description"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i);
    if (jsonDescMatch && jsonDescMatch[1]) {
      const extracted = jsonDescMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, ' ')
        .trim();
      const cleaned = this.stripInlinePreambles(extracted);
      if (cleaned.length >= 20 && !this.isPreamble(cleaned)) {
        return { description: this.finalizeText(cleaned) };
      }
    }

    // 2. Look for quoted description block: "Discover our sleek..." or "Introducing..."
    const quoteMatches = text.match(/"([^"\n\\]{25,}(?:\\.[^"\n\\]*)*)"/g);
    if (quoteMatches && quoteMatches.length > 0) {
      for (let i = quoteMatches.length - 1; i >= 0; i--) {
        const rawQuote = quoteMatches[i].slice(1, -1).replace(/\\"/g, '"').trim();
        const cleanedQuote = this.stripInlinePreambles(rawQuote);
        if (cleanedQuote.length >= 20 && !this.isPreamble(cleanedQuote)) {
          return { description: this.finalizeText(cleanedQuote) };
        }
      }
    }

    // 3. Try parsing entire string as JSON object
    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const toParse = codeBlockMatch ? codeBlockMatch[1].trim() : text;
      const parsed = JSON.parse(toParse);
      if (parsed && typeof parsed === 'object') {
        const desc = parsed.description || parsed.product_description || parsed.collection_description;
        if (typeof desc === 'string') {
          const cleaned = this.stripInlinePreambles(desc.trim());
          if (cleaned.length >= 20 && !this.isPreamble(cleaned)) {
            return { description: this.finalizeText(cleaned) };
          }
        }
      }
    } catch {
      // Continue to heuristic text extraction
    }

    // 4. Check for "Product Description:", "Collection Description:", or "Description:" marker
    const markerMatch = text.match(/(?:(?:Product|Collection)\s+)?Description\s*:\s*([\s\S]+)/i);
    if (markerMatch && markerMatch[1]) {
      text = markerMatch[1].trim();
    }

    // 5. Strip inline preambles
    text = this.stripInlinePreambles(text);

    // 6. Remove leading/trailing quotes, brackets, braces
    text = text.replace(/^[{"\'\s]+|[}"\'\s]+$/g, '').trim();

    // 7. Filter out line-by-line conversational / meta statements
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const cleanedLines: string[] = [];
    for (const line of lines) {
      if (/^(?:Note|Rules|Task|Prompt|Example|Input|Output)\s*:/i.test(line)) continue;
      if (/^\*\*(?:Color|Material|Design|Fabric|Style|Size)\*\*:/i.test(line)) continue;
      if (this.isPreamble(line)) continue;
      cleanedLines.push(line);
    }

    const merged = cleanedLines.length > 0 ? cleanedLines.join(' ') : text;
    const finalDescription = this.finalizeText(merged);

    if (finalDescription.length < 15) {
      this.logger.error(`Extracted description too short or invalid: "${finalDescription}" from raw: "${rawText.slice(0, 120)}"`);
      throw new AiValidationError('Could not extract a valid description from model response');
    }

    return {
      description: finalDescription,
    };
  }

  private stripInlinePreambles(s: string): string {
    const patterns = [
      /^(?:The description should|The product description should|The product should|In this task|Using only the product data|You should describe|To achieve this|How can I|To generate|To optimize|Write a catchy|Write an engaging)[^\.\?!]*[\.\?!]\s*/gi,
      /^(?:Please provide me with|def create_product_description)[^\.\?!]*[\.\?!]\s*/gi,
      /^```[a-z]*\s*/gi,
      /\s*```$/gi,
    ];
    let cleaned = s;
    for (const p of patterns) {
      cleaned = cleaned.replace(p, '').trim();
    }
    return cleaned;
  }

  private isPreamble(text: string): boolean {
    return /^(?:The description should|The product description should|The product should|In this task|Using only|You should describe|To achieve this|How can I|To generate|To optimize|def create|Write a|Generate a|Here is an example|For example)\b/i.test(
      text.trim(),
    );
  }

  private finalizeText(text: string): string {
    let clean = text
      .replace(/\r\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .replace(/\\"/g, '"')
      .trim();

    // End on a complete sentence if truncated by token limit
    const lastPunct = Math.max(clean.lastIndexOf('.'), clean.lastIndexOf('!'), clean.lastIndexOf('?'));
    if (lastPunct > 25 && lastPunct < clean.length - 1) {
      clean = clean.slice(0, lastPunct + 1).trim();
    }

    return clean;
  }
}
