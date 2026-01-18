import pLimit from 'p-limit';

const DEFAULT_CONCURRENCY = 5;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface RateLimiterOptions {
  concurrency?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

/**
 * Create a rate-limited processor for batch operations
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    maxRetries = MAX_RETRIES,
    initialBackoffMs = INITIAL_BACKOFF_MS,
  } = options;

  const limit = pLimit(concurrency);

  /**
   * Process items with rate limiting and retry logic
   */
  async function processWithRetry<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress?: (completed: number, total: number, item: T, result: R | null, error?: Error) => void
  ): Promise<Array<{ item: T; result: R | null; error?: Error }>> {
    let completed = 0;
    const total = items.length;

    const results = await Promise.all(
      items.map((item, index) =>
        limit(async () => {
          let lastError: Error | undefined;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              const result = await processor(item, index);
              completed++;
              onProgress?.(completed, total, item, result);
              return { item, result, error: undefined };
            } catch (error) {
              lastError = error as Error;

              // Check if it's a rate limit error (429)
              const isRateLimit = 
                lastError.message.includes('429') ||
                lastError.message.includes('rate limit') ||
                lastError.message.includes('too many requests');

              if (isRateLimit && attempt < maxRetries - 1) {
                const backoffMs = initialBackoffMs * Math.pow(2, attempt);
                console.warn(`Rate limited on item ${index}, retrying in ${backoffMs}ms...`);
                await sleep(backoffMs);
              } else if (attempt < maxRetries - 1) {
                // Non-rate-limit error, shorter backoff
                await sleep(initialBackoffMs);
              }
            }
          }

          // All retries failed
          completed++;
          onProgress?.(completed, total, item, null, lastError);
          return { item, result: null, error: lastError };
        })
      )
    );

    return results;
  }

  /**
   * Process items and collect only successful results
   */
  async function processAll<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<R[]> {
    const results = await processWithRetry(
      items,
      processor,
      (completed, total) => onProgress?.(completed, total)
    );

    return results
      .filter((r): r is { item: T; result: R; error: undefined } => r.result !== null)
      .map(r => r.result);
  }

  return {
    processWithRetry,
    processAll,
    limit, // Expose raw limiter for custom usage
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items in chunks with delay between chunks
 */
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processor: (item: T) => Promise<R>,
  delayBetweenChunks: number = 1000
): Promise<R[]> {
  const chunks = chunkArray(items, chunkSize);
  const results: R[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);

    // Delay between chunks (except after last chunk)
    if (i < chunks.length - 1) {
      await sleep(delayBetweenChunks);
    }
  }

  return results;
}

