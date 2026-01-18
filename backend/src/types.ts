// Spreadsheet types
export interface SpreadsheetRow {
  id: string;
  data: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'error';
  research?: ResearchResult;
}

export interface SpreadsheetData {
  headers: string[];
  rows: SpreadsheetRow[];
  fileName: string;
}

// Research result
export interface ResearchResult {
  summary: string;
  details: Record<string, unknown>;
  sources?: string[];
  confidence: number;
  timestamp: number;
}

// LLM types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// WebSocket message types
export type WebSocketMessageType = 
  | 'voice_input'
  | 'research_request'
  | 'research_update'
  | 'research_complete'
  | 'audio_chunk'
  | 'error'
  | 'status';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: unknown;
  timestamp: number;
}

export interface ResearchRequestPayload {
  transcript: string;
  spreadsheetData: SpreadsheetData;
}

export interface ResearchUpdatePayload {
  rowId: string;
  status: 'processing' | 'completed' | 'error';
  result?: ResearchResult;
  error?: string;
}

// Research prompt context
export interface ResearchContext {
  query: string;
  rowData: Record<string, string>;
  additionalContext?: string;
}

