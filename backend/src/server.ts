import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { config, logConfigStatus } from './config.js';
import { createOrchestrator } from './orchestrator.js';
import type { WebSocketMessage, ResearchRequestPayload } from './types.js';

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    env: config.NODE_ENV,
  });
});

// REST endpoint for CSV upload (alternative to WebSocket)
app.post('/api/upload', (req, res) => {
  // Handle file upload if needed
  res.json({ message: 'Upload endpoint ready' });
});

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 Client connected');

  // Create orchestrator for this connection
  const orchestrator = createOrchestrator({
    sendMessage: (message) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    sendAudioChunk: (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send audio as binary with a type prefix
        const header = Buffer.from([0x01]); // 0x01 = audio chunk
        ws.send(Buffer.concat([header, chunk]), { binary: true });
      }
    },
  });

  // Handle incoming messages
  ws.on('message', async (data: Buffer) => {
    try {
      // Check if binary data (audio from client)
      if (data[0] === 0x02) {
        // Handle audio input if needed
        console.log('Received audio input');
        return;
      }

      // Parse JSON message
      const message: WebSocketMessage = JSON.parse(data.toString());
      console.log('📩 Received:', message.type);

      switch (message.type) {
        case 'research_request': {
          const payload = message.payload as ResearchRequestPayload;
          await orchestrator.processRequest(
            payload.transcript,
            payload.spreadsheetData
          );
          break;
        }

        case 'voice_input': {
          // Handle real-time voice input if needed
          console.log('Voice input received');
          break;
        }

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      
      const errorMessage: WebSocketMessage = {
        type: 'error',
        payload: { message: (error as Error).message },
        timestamp: Date.now(),
      };
      
      ws.send(JSON.stringify(errorMessage));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send connection confirmation
  const welcomeMessage: WebSocketMessage = {
    type: 'status',
    payload: { status: 'connected', message: 'Connected to Research Agent' },
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(welcomeMessage));
});

// Start server
function start() {
  logConfigStatus();
  
  server.listen(config.PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Research Agent Backend                            ║
║                                                        ║
║   REST API:    http://localhost:${config.PORT}/api          ║
║   WebSocket:   ws://localhost:${config.PORT}/ws             ║
║   Health:      http://localhost:${config.PORT}/api/health   ║
║                                                        ║
║   Environment: ${config.NODE_ENV.padEnd(12)}                       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
start();

