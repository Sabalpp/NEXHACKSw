import { z } from 'zod';

// Research result schema for validation
export const ResearchResultSchema = z.object({
  summary: z.string().min(1),
  details: z.record(z.unknown()).default({}),
  sources: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedResearch = z.infer<typeof ResearchResultSchema>;

/**
 * Safely extracts JSON from LLM response
 * Handles markdown fences, prose, and malformed output
 */
export function extractJSON<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  let cleaned = text.trim();

  // Step 1: Remove markdown code fences
  // Handles ```json, ```, ```javascript, etc.
  const fencePatterns = [
    /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/,
    /^```\s*\n?([\s\S]*?)\n?```$/,
  ];

  for (const pattern of fencePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      cleaned = match[1].trim();
      break;
    }
  }

  // Step 2: Try direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to fallback methods
  }

  // Step 3: Find first complete JSON object using bracket depth
  const jsonMatch = findJSONObject(cleaned);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch) as T;
    } catch {
      // Continue to more aggressive extraction
    }
  }

  // Step 4: Try to extract JSON from within prose text
  const jsonInText = extractJSONFromText(cleaned);
  if (jsonInText) {
    try {
      return JSON.parse(jsonInText) as T;
    } catch {
      // Give up
    }
  }

  return null;
}

/**
 * Find the first complete JSON object using bracket depth counting
 */
function findJSONObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Try to extract JSON from text that might have prose around it
 */
function extractJSONFromText(text: string): string | null {
  // Look for patterns like "Here is the JSON: {...}" or "Response: {...}"
  const patterns = [
    /(?:json|result|response|output|data)\s*[:=]?\s*(\{[\s\S]*\})/i,
    /(\{[\s\S]*"summary"[\s\S]*"confidence"[\s\S]*\})/i,
    /(\{[\s\S]*\})\s*$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Validate it looks like JSON
      const potential = match[1].trim();
      if (potential.startsWith('{') && potential.endsWith('}')) {
        return potential;
      }
    }
  }

  return null;
}

/**
 * Extract and validate research result from LLM response
 */
export function extractResearchResult(text: string): ExtractedResearch | null {
  const extracted = extractJSON<Record<string, unknown>>(text);
  if (!extracted) {
    console.warn('Failed to extract JSON from response');
    return null;
  }

  const result = ResearchResultSchema.safeParse(extracted);
  if (!result.success) {
    console.warn('JSON validation failed:', result.error.issues);
    
    // Try to salvage partial data
    return {
      summary: String(extracted.summary || 'Research completed but output was malformed'),
      details: extracted.details as Record<string, unknown> || {},
      sources: Array.isArray(extracted.sources) ? extracted.sources.map(String) : undefined,
      confidence: typeof extracted.confidence === 'number' ? extracted.confidence : 0.3,
    };
  }

  return result.data;
}

/**
 * Create a repair prompt for malformed JSON
 */
export function createRepairPrompt(originalPrompt: string, malformedResponse: string): string {
  return `The previous response was not valid JSON. Here was the malformed response:

${malformedResponse.slice(0, 500)}${malformedResponse.length > 500 ? '...' : ''}

Please provide ONLY a valid JSON object with no additional text.
Original request: ${originalPrompt}

Remember: Output ONLY the JSON object, nothing else.`;
}

