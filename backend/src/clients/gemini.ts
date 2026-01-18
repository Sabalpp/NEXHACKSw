import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { LLMCompletionOptions, LLMResponse, LLMMessage } from '../types.js';

const DEFAULT_MODEL = 'gemini-1.5-pro';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(config.GEMINI_KEY);

// Strict JSON mode system prompt
const STRICT_JSON_SYSTEM = `You are a research assistant that ONLY outputs valid JSON.
CRITICAL RULES:
1. Output ONLY a JSON object - no markdown, no explanations, no prose
2. Do not wrap JSON in code fences (\`\`\`)
3. Do not add any text before or after the JSON
4. Ensure all strings are properly escaped
5. Use double quotes for all keys and string values

Your response must be parseable by JSON.parse() without any preprocessing.`;

/**
 * Convert our LLM message format to Gemini format
 */
function convertToGeminiMessages(messages: LLMMessage[]): { role: string; parts: { text: string }[] }[] {
  const geminiMessages: { role: string; parts: { text: string }[] }[] = [];
  
  // Combine system messages with the first user message
  let systemContent = '';
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemContent += msg.content + '\n\n';
    } else {
      const content = msg.role === 'user' && systemContent 
        ? `${systemContent}${msg.content}`
        : msg.content;
      
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      });
      
      if (msg.role === 'user') {
        systemContent = ''; // Clear system content after first user message
      }
    }
  }
  
  return geminiMessages;
}

/**
 * Gemini completion - used as fallback LLM
 */
export async function geminiCompletion(
  options: LLMCompletionOptions
): Promise<LLMResponse> {
  const { model = DEFAULT_MODEL, messages, temperature = 0.7, maxTokens = 4096 } = options;

  // Add strict JSON system message
  const enhancedMessages: LLMMessage[] = [
    { role: 'system', content: STRICT_JSON_SYSTEM },
    ...messages,
  ];

  const geminiModel = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const geminiMessages = convertToGeminiMessages(enhancedMessages);
  
  // For chat completion
  const chat = geminiModel.startChat({
    history: geminiMessages.slice(0, -1),
  });

  const lastMessage = geminiMessages[geminiMessages.length - 1];
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  const response = await result.response;
  const content = response.text();

  return {
    content,
    model,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };
}

/**
 * Simple Gemini completion without chat history
 */
export async function geminiSimpleCompletion(
  prompt: string,
  options: Partial<LLMCompletionOptions> = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 4096 } = options;

  const geminiModel = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const enhancedPrompt = `${STRICT_JSON_SYSTEM}\n\n${prompt}`;
  const result = await geminiModel.generateContent(enhancedPrompt);
  const response = await result.response;
  
  return response.text();
}

/**
 * Helper to create a research prompt for Gemini
 */
export function createGeminiResearchPrompt(
  query: string,
  entityData: Record<string, string>
): string {
  const entityInfo = Object.entries(entityData)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `Research the following entity based on this query: "${query}"

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
Remember: Output ONLY the JSON object, nothing else.`;
}

