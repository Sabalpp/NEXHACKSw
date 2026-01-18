import { useEffect, useState, useMemo } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';

interface VoiceRecorderProps {
  onTranscriptChange?: (transcript: string) => void;
  onTranscriptSubmit?: (transcript: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ 
  onTranscriptChange, 
  onTranscriptSubmit,
  disabled = false 
}: VoiceRecorderProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
  } = useVoiceInput();

  const [isEditing, setIsEditing] = useState(false);

  // Generate random waveform heights for animation
  const waveformBars = useMemo(() => 
    Array.from({ length: 12 }, () => Math.random() * 0.6 + 0.4), 
    []
  );

  useEffect(() => {
    onTranscriptChange?.(transcript);
  }, [transcript, onTranscriptChange]);

  const handleSubmit = () => {
    if (transcript.trim()) {
      onTranscriptSubmit?.(transcript.trim());
      clearTranscript();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isSupported) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 text-heat">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-display">Voice input not supported in this browser</span>
        </div>
        <p className="mt-2 text-sm text-void-400">
          Please use Chrome, Edge, or Safari for voice features.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg text-void-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice Input
        </h3>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isListening ? 'status-dot-active' : 'status-dot-inactive'}`} />
          <span className="text-sm text-void-400">
            {isListening ? 'Listening...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Waveform visualization */}
      <div className="flex items-center justify-center h-16 gap-1">
        {waveformBars.map((height, index) => (
          <div
            key={index}
            className={`waveform-bar ${isListening ? 'animate-wave' : ''}`}
            style={{
              height: isListening ? `${height * 100}%` : '20%',
              animationDelay: `${index * 0.1}s`,
              opacity: isListening ? 1 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Main mic button */}
      <div className="flex justify-center">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={disabled}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 transform
            ${isListening 
              ? 'bg-danger/20 border-2 border-danger shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110' 
              : 'bg-pulse/20 border-2 border-pulse hover:shadow-glow-md hover:scale-105'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {isListening ? (
            // Stop icon
            <svg className="w-8 h-8 text-danger" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // Mic icon
            <svg className="w-8 h-8 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
          
          {/* Pulse animation ring */}
          {isListening && (
            <span className="absolute inset-0 rounded-full border-2 border-danger animate-ping opacity-50" />
          )}
        </button>
      </div>

      <p className="text-center text-sm text-void-400">
        {isListening ? 'Click to stop recording' : 'Click to start recording'}
      </p>

      {/* Transcript area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-display text-void-300">Transcript</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-void-400 hover:text-pulse transition-colors"
            >
              {isEditing ? 'Done' : 'Edit'}
            </button>
            {transcript && (
              <button
                onClick={clearTranscript}
                className="text-xs text-void-400 hover:text-danger transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field min-h-[100px] resize-none font-mono text-sm"
            placeholder="Type or edit your query here..."
          />
        ) : (
          <div className="input-field min-h-[100px] font-mono text-sm overflow-auto custom-scrollbar">
            {transcript || interimTranscript ? (
              <>
                <span>{transcript}</span>
                {interimTranscript && (
                  <span className="text-void-400 italic">{interimTranscript}</span>
                )}
              </>
            ) : (
              <span className="text-void-500">
                Your speech will appear here...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!transcript.trim() || disabled}
        className={`
          w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed 
          disabled:hover:scale-100 disabled:shadow-none
        `}
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Start Research
        </span>
      </button>
    </div>
  );
}

