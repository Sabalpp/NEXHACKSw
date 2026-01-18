import { createResearchWorker } from './workers/researchWorker.js';
import { mapReduceResearch, generateVoiceSummary } from './utils/mapReduce.js';
import { createTTSSession, textToSpeech } from './clients/elevenlabs.js';
import type { SpreadsheetData, ResearchResult, WebSocketMessage } from './types.js';
import type { ExtractedResearch } from './utils/jsonExtractor.js';

interface OrchestratorOptions {
  sendMessage: (message: WebSocketMessage) => void;
  sendAudioChunk: (chunk: Buffer) => void;
}

/**
 * Main orchestrator that coordinates the research flow:
 * 1. Receives voice transcript and spreadsheet data
 * 2. Processes rows with rate-limited LLM calls
 * 3. Aggregates results with map-reduce
 * 4. Streams voice summary via TTS
 */
export class ResearchOrchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions) {
    this.options = options;
  }

  /**
   * Process a research request
   */
  async processRequest(
    transcript: string,
    spreadsheetData: SpreadsheetData
  ): Promise<void> {
    console.log('🎯 Starting research orchestration');
    console.log(`🎯 Query: "${transcript}"`);
    console.log(`🎯 Rows: ${spreadsheetData.rows.length}`);

    // Send status update
    this.options.sendMessage({
      type: 'status',
      payload: { status: 'processing', message: 'Starting research...' },
      timestamp: Date.now(),
    });

    try {
      // Create research worker
      const worker = createResearchWorker((progress) => {
        this.options.sendMessage({
          type: 'research_update',
          payload: progress,
          timestamp: Date.now(),
        });
      });

      // Process all rows
      const results = await worker.processRows(transcript, spreadsheetData.rows);
      
      // Convert to array for map-reduce
      const extractedResults: ExtractedResearch[] = [];
      results.forEach((result) => {
        extractedResults.push({
          summary: result.summary,
          details: result.details,
          sources: result.sources,
          confidence: result.confidence,
        });
      });

      // Generate aggregated summary if we have results
      let voiceSummary = 'Research complete.';
      
      if (extractedResults.length > 0) {
        console.log('📊 Running map-reduce aggregation...');
        const { summary } = await mapReduceResearch(extractedResults, transcript);
        
        console.log('🎤 Generating voice summary...');
        voiceSummary = await generateVoiceSummary(summary, extractedResults.length);
      }

      // Stream TTS audio
      await this.streamTTS(voiceSummary);

      // Send completion message
      this.options.sendMessage({
        type: 'research_complete',
        payload: {
          summary: voiceSummary,
          totalProcessed: results.size,
          totalRows: spreadsheetData.rows.length,
        },
        timestamp: Date.now(),
      });

      console.log('✅ Research orchestration complete');
    } catch (error) {
      console.error('❌ Orchestration error:', error);
      
      this.options.sendMessage({
        type: 'error',
        payload: { 
          message: (error as Error).message,
          code: 'ORCHESTRATION_ERROR',
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Stream text-to-speech audio to client
   */
  private async streamTTS(text: string): Promise<void> {
    console.log('🔊 Starting TTS stream...');

    try {
      // For short text, use one-shot TTS
      if (text.length < 500) {
        const audioBuffer = await textToSpeech(text);
        this.options.sendAudioChunk(audioBuffer);
        
        this.options.sendMessage({
          type: 'audio_chunk',
          payload: { isLast: true },
          timestamp: Date.now(),
        });
        
        return;
      }

      // For longer text, use streaming
      const tts = createTTSSession(
        (chunk) => this.options.sendAudioChunk(chunk),
        () => {
          this.options.sendMessage({
            type: 'audio_chunk',
            payload: { isLast: true },
            timestamp: Date.now(),
          });
        },
        (error) => {
          console.error('TTS error:', error);
        }
      );

      await tts.connect();

      // Split text into sentences and stream
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      for (const sentence of sentences) {
        tts.sendText(sentence.trim() + ' ');
      }

      tts.close();
    } catch (error) {
      console.error('TTS streaming failed:', error);
      // Continue without TTS - not fatal
    }
  }

  /**
   * Process a single row (for incremental updates)
   */
  async processSingleRow(
    transcript: string,
    rowId: string,
    rowData: Record<string, string>
  ): Promise<ResearchResult | null> {
    const worker = createResearchWorker((progress) => {
      this.options.sendMessage({
        type: 'research_update',
        payload: progress,
        timestamp: Date.now(),
      });
    });

    const result = await worker.processSingleRow(transcript, {
      id: rowId,
      data: rowData,
      status: 'pending',
    });

    return result;
  }
}

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(options: OrchestratorOptions): ResearchOrchestrator {
  return new ResearchOrchestrator(options);
}

