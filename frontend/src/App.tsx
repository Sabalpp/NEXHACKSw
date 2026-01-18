import { useState, useCallback, useEffect } from 'react';
import { VoiceRecorder, SpreadsheetView, AudioPlayer, ResearchResults } from './components';
import { useWebSocket } from './hooks';
import type { SpreadsheetData, SpreadsheetRow, WebSocketMessage, ResearchUpdatePayload } from './types';

// Backend WebSocket URL - configure for your environment
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

function App() {
  // State
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [processingRows, setProcessingRows] = useState<string[]>([]);
  const [isResearching, setIsResearching] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');

  // Calculate progress
  const totalProgress = spreadsheetData 
    ? (spreadsheetData.rows.filter(r => r.status === 'completed' || r.status === 'error').length / spreadsheetData.rows.length) * 100
    : 0;

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'research_update': {
        const payload = message.payload as ResearchUpdatePayload;
        setSpreadsheetData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: prev.rows.map(row => 
              row.id === payload.rowId 
                ? { ...row, status: payload.status, research: payload.result }
                : row
            ),
          };
        });
        
        if (payload.status === 'processing') {
          setProcessingRows(prev => [...prev, payload.rowId]);
        } else {
          setProcessingRows(prev => prev.filter(id => id !== payload.rowId));
        }
        break;
      }
      
      case 'research_complete':
        setIsResearching(false);
        setProcessingRows([]);
        break;
        
      case 'audio_chunk': {
        const payload = message.payload as { chunk: ArrayBuffer; isLast: boolean };
        // Accumulate audio chunks and create blob when complete
        if (payload.isLast) {
          // In a real implementation, you'd accumulate chunks
          const blob = new Blob([payload.chunk], { type: 'audio/mpeg' });
          setAudioBlob(blob);
        }
        break;
      }
      
      case 'error':
        console.error('WebSocket error:', message.payload);
        setIsResearching(false);
        break;
    }
  }, []);

  // WebSocket connection
  const { status: connectionStatus, sendMessage } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
    onMessage: handleWebSocketMessage,
  });

  // Handle transcript submission
  const handleTranscriptSubmit = useCallback((text: string) => {
    if (!spreadsheetData || spreadsheetData.rows.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    const rowsToProcess = selectedRows.length > 0 
      ? selectedRows 
      : spreadsheetData.rows.map(r => r.id);

    // Reset row statuses
    setSpreadsheetData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map(row => ({
          ...row,
          status: rowsToProcess.includes(row.id) ? 'pending' : row.status,
          research: rowsToProcess.includes(row.id) ? undefined : row.research,
        })),
      };
    });

    setIsResearching(true);
    setAudioBlob(null);

    // Send research request
    sendMessage({
      type: 'research_request',
      payload: {
        transcript: text,
        spreadsheetData: {
          ...spreadsheetData,
          rows: spreadsheetData.rows.filter(r => rowsToProcess.includes(r.id)),
        },
      },
      timestamp: Date.now(),
    });
  }, [spreadsheetData, selectedRows, sendMessage]);

  // Export results to CSV
  const handleExport = useCallback(() => {
    if (!spreadsheetData) return;

    const completedRows = spreadsheetData.rows.filter(r => r.status === 'completed' && r.research);
    if (completedRows.length === 0) return;

    const headers = [...spreadsheetData.headers, 'Research Summary', 'Confidence'];
    const csvRows = completedRows.map(row => {
      const values = spreadsheetData.headers.map(h => row.data[h] || '');
      values.push(row.research?.summary || '');
      values.push(String(row.research?.confidence || 0));
      return values.map(v => `"${v.replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-results-${Date.now()}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  }, [spreadsheetData]);

  // Demo mode - simulate processing for UI testing
  const runDemoMode = useCallback(() => {
    if (!spreadsheetData) return;
    
    setIsResearching(true);
    let currentIndex = 0;
    
    const processNext = () => {
      if (currentIndex >= spreadsheetData.rows.length) {
        setIsResearching(false);
        setProcessingRows([]);
        return;
      }
      
      const row = spreadsheetData.rows[currentIndex];
      setProcessingRows([row.id]);
      
      setTimeout(() => {
        setSpreadsheetData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: prev.rows.map(r => 
              r.id === row.id 
                ? {
                    ...r,
                    status: 'completed' as const,
                    research: {
                      summary: `Research completed for ${Object.values(r.data)[0]}. This is demo data showing how results will appear when the backend is connected.`,
                      details: {},
                      confidence: 0.75 + Math.random() * 0.2,
                      timestamp: Date.now(),
                    },
                  }
                : r
            ),
          };
        });
        
        currentIndex++;
        setProcessingRows([]);
        setTimeout(processNext, 500);
      }, 1000);
    };
    
    processNext();
  }, [spreadsheetData]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-void-700/50 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pulse to-glow flex items-center justify-center">
                  <svg className="w-6 h-6 text-void-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-display font-bold text-xl text-gradient">Research Agent</h1>
                  <p className="text-xs text-void-400">Voice-powered data enrichment</p>
                </div>
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-6">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                <span className={`status-dot ${
                  connectionStatus === 'connected' ? 'status-dot-active' :
                  connectionStatus === 'connecting' ? 'status-dot-processing' :
                  'status-dot-error'
                }`} />
                <span className="text-sm text-void-400 capitalize">{connectionStatus}</span>
              </div>

              {/* Demo button - for testing without backend */}
              {spreadsheetData && !isResearching && (
                <button
                  onClick={runDemoMode}
                  className="btn-secondary text-sm"
                >
                  Run Demo
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-[1800px] mx-auto h-full">
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
            {/* Left column - Voice Input */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
              <VoiceRecorder
                onTranscriptChange={setTranscript}
                onTranscriptSubmit={handleTranscriptSubmit}
                disabled={isResearching}
              />
              
              <AudioPlayer
                audioBlob={audioBlob || undefined}
                autoPlay={true}
                label="Voice Response"
              />
            </div>

            {/* Center column - Spreadsheet */}
            <div className="col-span-12 lg:col-span-5 h-full">
              <SpreadsheetView
                data={spreadsheetData}
                onDataChange={setSpreadsheetData}
                onRowSelect={setSelectedRows}
                selectedRows={selectedRows}
                processingRows={processingRows}
              />
            </div>

            {/* Right column - Results */}
            <div className="col-span-12 lg:col-span-4 h-full">
              <ResearchResults
                rows={spreadsheetData?.rows || []}
                onExport={handleExport}
                isProcessing={isResearching}
                totalProgress={totalProgress}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-void-700/50">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between text-sm text-void-500">
            <div className="flex items-center gap-4">
              {spreadsheetData && (
                <>
                  <span>{spreadsheetData.rows.length} rows loaded</span>
                  <span>•</span>
                  <span>{selectedRows.length} selected</span>
                </>
              )}
              {isResearching && (
                <>
                  <span>•</span>
                  <span className="text-heat">Processing...</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <span className="text-pulse">OpenRouter</span>
              <span>+</span>
              <span className="text-glow">ElevenLabs</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
