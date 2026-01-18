import { researchCompletion } from '../clients/llmOrchestrator.js';
import { createRateLimiter } from '../utils/rateLimiter.js';
import type { SpreadsheetRow, ResearchResult } from '../types.js';
import type { ExtractedResearch } from '../utils/jsonExtractor.js';

interface WorkerProgress {
  rowId: string;
  status: 'processing' | 'completed' | 'error';
  result?: ResearchResult;
  error?: string;
}

interface WorkerOptions {
  concurrency?: number;
  onProgress: (progress: WorkerProgress) => void;
}

/**
 * Research worker that processes spreadsheet rows
 */
export class ResearchWorker {
  private rateLimiter = createRateLimiter({ concurrency: 5 });
  private options: WorkerOptions;

  constructor(options: WorkerOptions) {
    this.options = options;
  }

  /**
   * Process a batch of rows with a research query
   */
  async processRows(
    query: string,
    rows: SpreadsheetRow[]
  ): Promise<Map<string, ResearchResult>> {
    const results = new Map<string, ResearchResult>();

    console.log(`🔬 Starting research on ${rows.length} rows`);
    console.log(`🔬 Query: "${query}"`);

    const processedResults = await this.rateLimiter.processWithRetry(
      rows,
      async (row) => {
        // Notify start
        this.options.onProgress({
          rowId: row.id,
          status: 'processing',
        });

        // Perform research
        const { result, provider, attempts } = await researchCompletion(query, row.data);
        
        console.log(`✅ Row ${row.id}: completed via ${provider} in ${attempts} attempt(s)`);

        return { row, research: result, provider };
      },
      (completed, total, item, result, error) => {
        if (error || !result) {
          this.options.onProgress({
            rowId: item.id,
            status: 'error',
            error: error?.message || 'Unknown error',
          });
        } else {
          const researchResult = this.toResearchResult(result.research);
          results.set(item.id, researchResult);
          
          this.options.onProgress({
            rowId: item.id,
            status: 'completed',
            result: researchResult,
          });
        }

        console.log(`📊 Progress: ${completed}/${total}`);
      }
    );

    // Collect successful results
    for (const { item, result } of processedResults) {
      if (result) {
        results.set(item.id, this.toResearchResult(result.research));
      }
    }

    console.log(`🔬 Research complete: ${results.size}/${rows.length} successful`);
    return results;
  }

  /**
   * Process a single row
   */
  async processSingleRow(
    query: string,
    row: SpreadsheetRow
  ): Promise<ResearchResult | null> {
    try {
      this.options.onProgress({
        rowId: row.id,
        status: 'processing',
      });

      const { result } = await researchCompletion(query, row.data);
      const researchResult = this.toResearchResult(result);

      this.options.onProgress({
        rowId: row.id,
        status: 'completed',
        result: researchResult,
      });

      return researchResult;
    } catch (error) {
      this.options.onProgress({
        rowId: row.id,
        status: 'error',
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Convert extracted research to ResearchResult type
   */
  private toResearchResult(extracted: ExtractedResearch): ResearchResult {
    return {
      summary: extracted.summary,
      details: extracted.details,
      sources: extracted.sources,
      confidence: extracted.confidence,
      timestamp: Date.now(),
    };
  }
}

/**
 * Create a research worker instance
 */
export function createResearchWorker(
  onProgress: (progress: WorkerProgress) => void
): ResearchWorker {
  return new ResearchWorker({ onProgress });
}

