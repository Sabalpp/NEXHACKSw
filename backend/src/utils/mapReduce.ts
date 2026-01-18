import { geminiSimpleCompletion } from '../clients/gemini.js';
import type { ExtractedResearch } from './jsonExtractor.js';

const MAX_SUMMARY_WORDS = 200;
const AGGREGATION_CHUNK_SIZE = 5;

/**
 * Truncate text to approximately N words
 */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Map phase: Summarize individual research results
 */
export function mapSummarize(results: ExtractedResearch[]): string[] {
  return results.map(result => {
    // Combine summary with key findings
    let summary = result.summary;
    
    if (result.details && typeof result.details === 'object') {
      const findings = (result.details as Record<string, unknown>).key_findings;
      if (Array.isArray(findings) && findings.length > 0) {
        summary += ' Key findings: ' + findings.slice(0, 3).join('; ');
      }
    }

    // Truncate to max words
    return truncateToWords(summary, MAX_SUMMARY_WORDS);
  });
}

/**
 * Reduce phase: Aggregate summaries into a final summary
 */
export async function reduceAggregate(
  summaries: string[],
  originalQuery: string
): Promise<string> {
  // If few summaries, aggregate directly
  if (summaries.length <= AGGREGATION_CHUNK_SIZE) {
    return await aggregateSummaries(summaries, originalQuery);
  }

  // Hierarchical reduction for large sets
  const chunks: string[][] = [];
  for (let i = 0; i < summaries.length; i += AGGREGATION_CHUNK_SIZE) {
    chunks.push(summaries.slice(i, i + AGGREGATION_CHUNK_SIZE));
  }

  // First level: aggregate each chunk
  const firstLevelSummaries = await Promise.all(
    chunks.map(chunk => aggregateSummaries(chunk, originalQuery))
  );

  // Second level: aggregate the aggregations
  return await aggregateSummaries(firstLevelSummaries, originalQuery);
}

/**
 * Aggregate a set of summaries using LLM
 */
async function aggregateSummaries(
  summaries: string[],
  originalQuery: string
): Promise<string> {
  const numberedSummaries = summaries
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n\n');

  const prompt = `You are aggregating research summaries. The original query was: "${originalQuery}"

Here are the individual research summaries:

${numberedSummaries}

Create a cohesive 3-5 sentence summary that:
1. Captures the key themes and patterns across all results
2. Highlights the most important findings
3. Notes any significant differences or outliers
4. Provides actionable insights

Keep your response concise and directly useful. Do not use bullet points, write in flowing prose.`;

  try {
    return await geminiSimpleCompletion(prompt, { temperature: 0.5, maxTokens: 500 });
  } catch (error) {
    console.error('Aggregation failed:', error);
    // Fallback: simple concatenation
    return summaries.slice(0, 3).join(' ');
  }
}

/**
 * Full map-reduce pipeline for research results
 */
export async function mapReduceResearch(
  results: ExtractedResearch[],
  originalQuery: string
): Promise<{ summary: string; individualSummaries: string[] }> {
  console.log(`📊 Map-reduce: processing ${results.length} results`);

  // Map phase
  const individualSummaries = mapSummarize(results);
  console.log(`📊 Map phase complete: ${individualSummaries.length} summaries`);

  // Reduce phase
  const summary = await reduceAggregate(individualSummaries, originalQuery);
  console.log(`📊 Reduce phase complete`);

  return { summary, individualSummaries };
}

/**
 * Generate a voice-friendly summary for TTS
 */
export async function generateVoiceSummary(
  aggregatedSummary: string,
  entityCount: number
): Promise<string> {
  const prompt = `Convert this research summary into a natural, conversational response suitable for voice output (text-to-speech).

Summary: ${aggregatedSummary}

Requirements:
1. Start with a brief acknowledgment like "I've researched ${entityCount} items for you."
2. Use natural speech patterns and transitions
3. Avoid technical jargon and abbreviations
4. Keep it under 100 words
5. End with a closing like "Is there anything specific you'd like me to elaborate on?"

Write ONLY the voice response, nothing else.`;

  try {
    return await geminiSimpleCompletion(prompt, { temperature: 0.7, maxTokens: 200 });
  } catch {
    return `I've completed research on ${entityCount} items. ${aggregatedSummary}`;
  }
}

