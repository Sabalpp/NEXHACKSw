import axios from 'axios';
import { config } from '../config.js';
import type { LLMCompletionOptions, LLMResponse, LLMMessage } from '../types.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-2024-08-06';
const TIMEOUT_MS = 30000;

// Strict JSON mode system prompt
const STRICT_JSON_SYSTEM = `You are a research assistant that ONLY outputs valid JSON.
CRITICAL RULES:
1. Output ONLY a JSON object - no markdown, no explanations, no prose
2. Do not wrap JSON in code fences (\`\`\`)
3. Do not add any text before or after the JSON
4. Ensure all strings are properly escaped
5. Use double quotes for all keys and string values

Your response must be parseable by JSON.parse() without any preprocessing.`;

export interface OpenRouterStreamCallback {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

/**
 * OpenRouter completion - non-streaming
 */
export async function openrouterCompletion(
  options: LLMCompletionOptions
): Promise<LLMResponse> {
  const { model = DEFAULT_MODEL, messages, temperature = 0.7, maxTokens = 4096 } = options;

  // Prepend strict JSON system message
  const enhancedMessages: LLMMessage[] = [
    { role: 'system', content: STRICT_JSON_SYSTEM },
    ...messages,
  ];

  const response = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    {
      model,
      messages: enhancedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    },
    {
      headers: {
        'Authorization': `Bearer ${config.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://research-agent.app',
        'X-Title': 'Research Agent',
      },
      timeout: TIMEOUT_MS,
    }
  );

  const choice = response.data.choices?.[0];
  if (!choice) {
    throw new Error('No response from OpenRouter');
  }

  return {
    content: choice.message.content,
    model: response.data.model,
    usage: response.data.usage ? {
      promptTokens: response.data.usage.prompt_tokens,
      completionTokens: response.data.usage.completion_tokens,
      totalTokens: response.data.usage.total_tokens,
    } : undefined,
  };
}

/**
 * OpenRouter streaming completion via SSE
 */
export async function openrouterStream(
  options: LLMCompletionOptions,
  callbacks: OpenRouterStreamCallback
): Promise<string> {
  const { model = DEFAULT_MODEL, messages, temperature = 0.7, maxTokens = 4096 } = options;

  // Prepend strict JSON system message
  const enhancedMessages: LLMMessage[] = [
    { role: 'system', content: STRICT_JSON_SYSTEM },
    ...messages,
  ];

  return new Promise((resolve, reject) => {
    let fullContent = '';
    
    axios({
      method: 'post',
      url: `${OPENROUTER_BASE}/chat/completions`,
      data: {
        model,
        messages: enhancedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      },
      headers: {
        'Authorization': `Bearer ${config.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://research-agent.app',
        'X-Title': 'Research Agent',
      },
      responseType: 'stream',
      timeout: TIMEOUT_MS,
    })
      .then(response => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                callbacks.onComplete?.(fullContent);
                resolve(fullContent);
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullContent += content;
                  callbacks.onChunk?.(content);
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('error', (error: Error) => {
          callbacks.onError?.(error);
          reject(error);
        });

        response.data.on('end', () => {
          if (fullContent) {
            callbacks.onComplete?.(fullContent);
            resolve(fullContent);
          }
        });
      })
      .catch(error => {
        callbacks.onError?.(error);
        reject(error);
      });
  });
}

/**
 * Helper to create a research prompt
 */
export function createResearchPrompt(
  query: string,
  entityData: Record<string, string>
): LLMMessage[] {
  const entityInfo = Object.entries(entityData)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return [
    {
      role: 'user',
      content: `Research the following entity based on this query: "${query}"

Entity Information:
${entityInfo}

Respond with a JSON object in this exact format:
{
  "summary": "A concise 2-3 sentence summary of the research findings",
  "details": {
    "key_findings": ["finding 1", "finding 2"],
    "relevant_data": {}
  },
  "sources": ["source1.com", "source2.com"],
  "confidence": 0.85
}

The confidence score should be between 0 and 1 based on how reliable the information is.
Remember: Output ONLY the JSON object, nothing else.`,
    },
  ];
}

