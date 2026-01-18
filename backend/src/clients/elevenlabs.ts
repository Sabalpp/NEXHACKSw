import WebSocket from 'ws';
import { config } from '../config.js';

const ELEVENLABS_WS_URL = 'wss://api.elevenlabs.io/v1/text-to-speech';

interface ElevenLabsSocketOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  onAudioChunk: (chunk: Buffer) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * ElevenLabs WebSocket client for streaming TTS
 * Allows sending text chunks and receiving audio in real-time
 */
export class ElevenLabsSocket {
  private ws: WebSocket | null = null;
  private options: ElevenLabsSocketOptions;
  private isConnected = false;
  private messageQueue: string[] = [];

  constructor(options: ElevenLabsSocketOptions) {
    this.options = {
      voiceId: config.ELEVENLABS_VOICE_ID,
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      ...options,
    };
  }

  /**
   * Connect to ElevenLabs WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${ELEVENLABS_WS_URL}/${this.options.voiceId}/stream-input?model_id=${this.options.modelId}`;
      
      this.ws = new WebSocket(url, {
        headers: {
          'xi-api-key': config.ELEVENLABS_KEY,
        },
      });

      this.ws.on('open', () => {
        console.log('🔊 ElevenLabs WebSocket connected');
        this.isConnected = true;

        // Send initial configuration
        this.ws?.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: this.options.stability,
            similarity_boost: this.options.similarityBoost,
          },
          xi_api_key: config.ELEVENLABS_KEY,
        }));

        // Process queued messages
        while (this.messageQueue.length > 0) {
          const text = this.messageQueue.shift();
          if (text) this.sendText(text);
        }

        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.audio) {
            // Decode base64 audio and emit
            const audioBuffer = Buffer.from(message.audio, 'base64');
            this.options.onAudioChunk(audioBuffer);
          }
          
          if (message.isFinal) {
            this.options.onComplete?.();
          }
        } catch {
          // Raw audio data
          this.options.onAudioChunk(data);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ ElevenLabs WebSocket error:', error);
        this.options.onError?.(error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔊 ElevenLabs WebSocket closed');
        this.isConnected = false;
      });
    });
  }

  /**
   * Send text to be synthesized
   */
  sendText(text: string): void {
    if (!this.ws || !this.isConnected) {
      this.messageQueue.push(text);
      return;
    }

    this.ws.send(JSON.stringify({
      text: text,
      try_trigger_generation: true,
    }));
  }

  /**
   * Signal end of input and flush remaining audio
   */
  flush(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        text: '',
      }));
    }
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.flush();
      setTimeout(() => {
        this.ws?.close();
        this.ws = null;
      }, 500);
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Simple one-shot TTS using REST API (for shorter text)
 */
export async function textToSpeech(
  text: string,
  voiceId?: string
): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || config.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.ELEVENLABS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a streaming TTS session
 * Returns functions to send text and receive audio
 */
export function createTTSSession(
  onAudioChunk: (chunk: Buffer) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): {
  connect: () => Promise<void>;
  sendText: (text: string) => void;
  close: () => void;
} {
  const socket = new ElevenLabsSocket({
    onAudioChunk,
    onComplete,
    onError,
  });

  return {
    connect: () => socket.connect(),
    sendText: (text: string) => socket.sendText(text),
    close: () => socket.close(),
  };
}

