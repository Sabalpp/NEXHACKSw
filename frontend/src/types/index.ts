// Spreadsheet data types
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

// Research result types
export interface ResearchResult {
  summary: string;
  details: Record<string, unknown>;
  sources?: string[];
  confidence: number;
  timestamp: number;
}

// Voice input types
export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
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

export interface AudioChunkPayload {
  chunk: ArrayBuffer;
  isLast: boolean;
}

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Audio player state
export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

