import { openrouterCompletion, openrouterStream, createResearchPrompt, type OpenRouterStreamCallback } from './openrouter.js';
import { geminiCompletion, geminiSimpleCompletion, createGeminiResearchPrompt } from './gemini.js';
import { extractResearchResult, createRepairPrompt, type ExtractedResearch } from '../utils/jsonExtractor.js';
import type { LLMCompletionOptions, LLMResponse } from '../types.js';

const TIMEOUT_MS = 5000; // 5 second timeout for primary LLM
const MAX_REPAIR_ATTEMPTS = 2;

type LLMProvider = 'openrouter' | 'gemini';

interface OrchestrationResult {
  response: LLMResponse;
  provider: LLMProvider;
  fallbackUsed: boolean;
}

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * Main LLM orchestrator with fallback logic
 * Primary: OpenRouter (GPT-4o or Claude)
 * Fallback: Gemini (on timeout, error, or invalid JSON)
 */
export async function llmCompletion(
  options: LLMCompletionOptions
): Promise<OrchestrationResult> {
  try {
    // Try OpenRouter with timeout
    console.log('🔄 Trying OpenRouter...');
    const response = await withTimeout(
      openrouterCompletion(options),
      TIMEOUT_MS,
      'OpenRouter timeout'
    );
    
    console.log('✅ OpenRouter responded');
    return {
      response,
      provider: 'openrouter',
      fallbackUsed: false,
    };
  } catch (error) {
    console.warn('⚠️ OpenRouter failed, falling back to Gemini:', (error as Error).message);
    
    // Fallback to Gemini
    try {
      const response = await geminiCompletion(options);
      console.log('✅ Gemini fallback succeeded');
      return {
        response,
        provider: 'gemini',
        fallbackUsed: true,
      };
    } catch (geminiError) {
      console.error('❌ Both LLMs failed');
      throw new Error(`All LLM providers failed. OpenRouter: ${(error as Error).message}, Gemini: ${(geminiError as Error).message}`);
    }
  }
}

/**
 * Streaming LLM completion with sentence detection for TTS
 */
export async function llmStreamCompletion(
  options: LLMCompletionOptions,
  callbacks: OpenRouterStreamCallback & { onSentence?: (sentence: string) => void }
): Promise<string> {
  let sentenceBuffer = '';
  const sentenceEndRegex = /[.!?]\s+/g;

  const wrappedCallbacks: OpenRouterStreamCallback = {
    onChunk: (chunk) => {
      callbacks.onChunk?.(chunk);
      
      // Accumulate and detect sentences for TTS
      sentenceBuffer += chunk;
      
      let match;
      let lastIndex = 0;
      while ((match = sentenceEndRegex.exec(sentenceBuffer)) !== null) {
        const sentence = sentenceBuffer.slice(lastIndex, match.index + 1).trim();
        if (sentence.length > 10) { // Only send substantial sentences
          callbacks.onSentence?.(sentence);
        }
        lastIndex = match.index + match[0].length;
      }
      
      // Keep the incomplete sentence in buffer
      if (lastIndex > 0) {
        sentenceBuffer = sentenceBuffer.slice(lastIndex);
      }
    },
    onComplete: (fullContent) => {
      // Send any remaining content as final sentence
      if (sentenceBuffer.trim().length > 0) {
        callbacks.onSentence?.(sentenceBuffer.trim());
      }
      callbacks.onComplete?.(fullContent);
    },
    onError: callbacks.onError,
  };

  try {
    return await openrouterStream(options, wrappedCallbacks);
  } catch (error) {
    console.warn('Streaming failed, falling back to non-streaming Gemini');
    // Fallback to non-streaming Gemini
    const response = await geminiCompletion(options);
    callbacks.onComplete?.(response.content);
    return response.content;
  }
}

/**
 * Research-specific completion with JSON validation and repair
 */
export async function researchCompletion(
  query: string,
  entityData: Record<string, string>
): Promise<{ result: ExtractedResearch; provider: LLMProvider; attempts: number }> {
  const messages = createResearchPrompt(query, entityData);
  let attempts = 0;
  let lastResponse = '';
  let lastProvider: LLMProvider = 'openrouter';

  while (attempts < MAX_REPAIR_ATTEMPTS + 1) {
    attempts++;

    try {
      // First attempt: use orchestrator
      if (attempts === 1) {
        const { response, provider } = await llmCompletion({ messages });
        lastResponse = response.content;
        lastProvider = provider;
      } else {
        // Repair attempt: use Gemini with repair prompt
        console.log(`🔧 Repair attempt ${attempts - 1}...`);
        const repairPrompt = createRepairPrompt(query, lastResponse);
        lastResponse = await geminiSimpleCompletion(repairPrompt);
        lastProvider = 'gemini';
      }

      // Try to extract and validate JSON
      const extracted = extractResearchResult(lastResponse);
      if (extracted) {
        console.log(`✅ Valid research result extracted on attempt ${attempts}`);
        return { result: extracted, provider: lastProvider, attempts };
      }

      console.warn(`⚠️ Invalid JSON on attempt ${attempts}`);
    } catch (error) {
      console.error(`❌ Attempt ${attempts} failed:`, (error as Error).message);
    }
  }

  // Return a fallback result
  console.error('❌ All extraction attempts failed, returning fallback');
  return {
    result: {
      summary: 'Research could not be completed due to processing errors.',
      details: {},
      confidence: 0.1,
    },
    provider: lastProvider,
    attempts,
  };
}

/**
 * Batch research with progress callback
 */
export async function batchResearchCompletion(
  query: string,
  entities: Array<{ id: string; data: Record<string, string> }>,
  onProgress: (id: string, result: ExtractedResearch | null, error?: string) => void
): Promise<Map<string, ExtractedResearch>> {
  const results = new Map<string, ExtractedResearch>();

  // Process sequentially for now (rate limiter will be added separately)
  for (const entity of entities) {
    try {
      const { result } = await researchCompletion(query, entity.data);
      results.set(entity.id, result);
      onProgress(entity.id, result);
    } catch (error) {
      console.error(`Failed to research entity ${entity.id}:`, error);
      onProgress(entity.id, null, (error as Error).message);
    }
  }

  return results;
}

