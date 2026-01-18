import { useState } from 'react';
import type { SpreadsheetRow, ResearchResult } from '../types';

interface ResearchResultsProps {
  rows: SpreadsheetRow[];
  onExport?: () => void;
  isProcessing?: boolean;
  totalProgress?: number;
}

export function ResearchResults({
  rows,
  onExport,
  isProcessing = false,
  totalProgress = 0,
}: ResearchResultsProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const completedRows = rows.filter(r => r.status === 'completed');
  const errorRows = rows.filter(r => r.status === 'error');
  const pendingRows = rows.filter(r => r.status === 'pending' || r.status === 'processing');

  const toggleExpand = (rowId: string) => {
    setExpandedRow(prev => prev === rowId ? null : rowId);
  };

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="card h-full flex flex-col">
        <h3 className="font-display font-semibold text-lg text-void-100 flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Research Results
        </h3>
        
        <div className="flex-1 flex flex-col items-center justify-center text-void-500">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="font-display text-lg mb-1">No results yet</p>
          <p className="text-sm text-void-600">Upload data and start research to see results</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-void-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Research Results
          </h3>
          <p className="text-sm text-void-400">
            {completedRows.length} completed · {errorRows.length} errors · {pendingRows.length} pending
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-void-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-void-700 text-pulse' : 'text-void-400 hover:text-void-200'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-void-700 text-pulse' : 'text-void-400 hover:text-void-200'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Export button */}
          {completedRows.length > 0 && (
            <button onClick={onExport} className="btn-secondary text-sm px-3 py-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Processing progress */}
      {isProcessing && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-void-400">Processing...</span>
            <span className="text-pulse font-mono">{Math.round(totalProgress)}%</span>
          </div>
          <div className="h-2 bg-void-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pulse to-accent-400 rounded-full transition-all duration-500"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {viewMode === 'cards' ? (
          <div className="grid gap-3">
            {rows.map((row) => (
              <ResultCard
                key={row.id}
                row={row}
                isExpanded={expandedRow === row.id}
                onToggle={() => toggleExpand(row.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <ResultListItem
                key={row.id}
                row={row}
                isExpanded={expandedRow === row.id}
                onToggle={() => toggleExpand(row.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ 
  row, 
  isExpanded, 
  onToggle 
}: { 
  row: SpreadsheetRow; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const primaryKey = Object.keys(row.data)[0];
  const primaryValue = row.data[primaryKey] || 'Unknown';

  return (
    <div 
      className={`
        glass rounded-xl overflow-hidden transition-all duration-300
        ${row.status === 'completed' ? 'border-success/30' : ''}
        ${row.status === 'error' ? 'border-danger/30' : ''}
        ${row.status === 'processing' ? 'border-heat/30' : ''}
      `}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-void-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={row.status} />
          <div className="text-left">
            <p className="font-display font-medium text-void-100">{primaryValue}</p>
            {row.research && (
              <p className="text-sm text-void-400 line-clamp-1">
                {row.research.summary.substring(0, 80)}...
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {row.research && (
            <ConfidenceBadge confidence={row.research.confidence} />
          )}
          <svg 
            className={`w-5 h-5 text-void-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && row.research && (
        <div className="px-4 pb-4 space-y-3 border-t border-void-700/50 animate-fade-in">
          <div className="pt-3">
            <h4 className="text-sm font-display font-medium text-void-300 mb-2">Summary</h4>
            <p className="text-sm text-void-200 leading-relaxed">{row.research.summary}</p>
          </div>

          {row.research.sources && row.research.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-display font-medium text-void-300 mb-2">Sources</h4>
              <div className="flex flex-wrap gap-2">
                {row.research.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-void-800 rounded text-pulse hover:bg-void-700 transition-colors"
                  >
                    Source {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-void-500 pt-2 border-t border-void-800">
            <span>Processed {new Date(row.research.timestamp).toLocaleTimeString()}</span>
            <span>Confidence: {Math.round(row.research.confidence * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultListItem({ 
  row, 
  isExpanded, 
  onToggle 
}: { 
  row: SpreadsheetRow; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const primaryKey = Object.keys(row.data)[0];
  const primaryValue = row.data[primaryKey] || 'Unknown';

  return (
    <div className="glass rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 hover:bg-void-800/30 transition-colors"
      >
        <StatusIcon status={row.status} size="sm" />
        <span className="flex-1 text-left text-sm text-void-200 truncate">{primaryValue}</span>
        {row.research && <ConfidenceBadge confidence={row.research.confidence} size="sm" />}
        <svg 
          className={`w-4 h-4 text-void-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && row.research && (
        <div className="px-3 pb-3 text-sm text-void-300 animate-fade-in">
          {row.research.summary}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status, size = 'md' }: { status: SpreadsheetRow['status']; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  
  switch (status) {
    case 'completed':
      return (
        <div className={`${sizeClass} rounded-full bg-success/20 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    case 'error':
      return (
        <div className={`${sizeClass} rounded-full bg-danger/20 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    case 'processing':
      return (
        <div className={`${sizeClass} rounded-full bg-heat/20 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-heat animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={`${sizeClass} rounded-full bg-void-700 flex items-center justify-center`}>
          <div className="w-2 h-2 rounded-full bg-void-500" />
        </div>
      );
  }
}

function ConfidenceBadge({ confidence, size = 'md' }: { confidence: number; size?: 'sm' | 'md' }) {
  const percentage = Math.round(confidence * 100);
  const color = percentage >= 80 ? 'text-success' : percentage >= 50 ? 'text-heat' : 'text-danger';
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';
  
  return (
    <span className={`${sizeClass} rounded-full bg-void-800 ${color} font-mono`}>
      {percentage}%
    </span>
  );
}

