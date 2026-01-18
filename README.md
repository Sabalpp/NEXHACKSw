# Voice Research Agent

A voice-powered research agent that enriches spreadsheet data using AI. Upload a CSV, speak your research query, and get AI-powered insights with voice responses.

![Research Agent](https://via.placeholder.com/800x400?text=Research+Agent+UI)

## Features

- **Voice Input**: Speak your research queries using Web Speech API
- **CSV Upload**: Drag-and-drop or browse for CSV files
- **AI Research**: Uses OpenRouter (GPT-4o/Claude) with Gemini fallback
- **Voice Response**: Stream audio responses via ElevenLabs TTS
- **Rate Limiting**: Process multiple rows in parallel without hitting API limits
- **Export Results**: Download enriched data as CSV

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind)                 │
├─────────────┬─────────────────────┬─────────────────┤
│  Voice      │  Spreadsheet        │  Research       │
│  Input      │  Table              │  Results        │
└─────────────┴──────────┬──────────┴─────────────────┘
                         │ WebSocket
┌────────────────────────┴────────────────────────────┐
│  Backend (Node.js + Express + TypeScript)           │
├─────────────────────────────────────────────────────┤
│  OpenRouter (Primary) → Gemini (Fallback)           │
│  ElevenLabs TTS │ Overshoot Vision │ Rate Limiter   │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- API keys for OpenRouter, Gemini, ElevenLabs

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sabalpp/NEXHACKSw.git
   cd NEXHACKSw
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run the frontend** (for frontend development only)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:5173

4. **Run the backend** (when backend is ready)
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Docker Development

```bash
# Start both frontend and backend
docker-compose up

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Production Build

```bash
# Build and run production containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build

# Frontend served at http://localhost:80
```

## Project Structure

```
NEXHACKSw/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── SpreadsheetView.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── ResearchResults.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useVoiceInput.ts
│   │   │   └── useWebSocket.ts
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx           # Main application
│   │   └── index.css         # Tailwind styles
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  # Node.js backend (Phase 2)
│   ├── src/
│   │   ├── clients/          # API clients
│   │   │   ├── openrouter.ts
│   │   │   ├── gemini.ts
│   │   │   ├── elevenlabs.ts
│   │   │   └── overshoot.ts
│   │   ├── utils/            # Utilities
│   │   │   ├── jsonExtractor.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── mapReduce.ts
│   │   ├── workers/          # Research workers
│   │   ├── config.ts         # Environment config
│   │   ├── orchestrator.ts   # Main flow
│   │   └── server.ts         # Express server
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml        # Development setup
├── docker-compose.prod.yml   # Production overrides
├── .env.example              # Environment template
└── README.md
```

## Frontend Components

### VoiceRecorder
- Push-to-talk microphone button
- Real-time speech transcription
- Editable transcript field
- Submit button to trigger research

### SpreadsheetView
- Drag-and-drop CSV upload
- Sortable data table
- Row selection for targeted research
- Processing status per row

### AudioPlayer
- Streaming audio playback
- Waveform visualization
- Play/pause/volume controls
- Auto-play on new responses

### ResearchResults
- Card and list view modes
- Expandable result details
- Confidence scores
- Export to CSV

## API Contract

### WebSocket Messages (Frontend → Backend)

```typescript
// Start research
{
  type: 'research_request',
  payload: {
    transcript: string,        // Voice command
    spreadsheetData: {
      headers: string[],
      rows: SpreadsheetRow[],
      fileName: string
    }
  },
  timestamp: number
}
```

### WebSocket Messages (Backend → Frontend)

```typescript
// Progress update
{
  type: 'research_update',
  payload: {
    rowId: string,
    status: 'processing' | 'completed' | 'error',
    result?: ResearchResult
  }
}

// Audio chunk
{
  type: 'audio_chunk',
  payload: {
    chunk: ArrayBuffer,
    isLast: boolean
  }
}

// Research complete
{
  type: 'research_complete',
  payload: { summary: string }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_KEY` | OpenRouter API key (primary LLM) | Yes |
| `GEMINI_KEY` | Google Gemini API key (fallback) | Yes |
| `ELEVENLABS_KEY` | ElevenLabs API key (TTS) | Yes |
| `ELEVENLABS_VOICE_ID` | Voice ID for TTS | Yes |
| `OVERSHOOT_KEY` | Overshoot AI key (optional) | No |
| `PORT` | Backend server port | No (default: 3001) |

## Demo Mode

The frontend includes a "Run Demo" button that simulates the research workflow without requiring a backend connection. This is useful for:
- UI development and testing
- Showcasing the interface
- Verifying frontend functionality

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Web Speech API

**Backend (Phase 2):**
- Node.js
- Express
- TypeScript
- WebSocket (ws)
- Zod validation

**APIs:**
- OpenRouter (GPT-4o, Claude 3.5)
- Google Gemini 1.5 Pro
- ElevenLabs TTS
- Overshoot AI (optional)

## License

MIT

