import { useState, useCallback, useRef } from 'react';
import type { SpreadsheetData, SpreadsheetRow } from '../types';

interface SpreadsheetViewProps {
  data: SpreadsheetData | null;
  onDataChange: (data: SpreadsheetData) => void;
  onRowSelect?: (rows: string[]) => void;
  selectedRows?: string[];
  processingRows?: string[];
}

export function SpreadsheetView({
  data,
  onDataChange,
  onRowSelect,
  selectedRows = [],
  processingRows = [],
}: SpreadsheetViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string, fileName: string): SpreadsheetData => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const rows: SpreadsheetRow[] = lines.slice(1).map((line, index) => {
      // Simple CSV parsing (handles basic quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const data: Record<string, string> = {};
      headers.forEach((header, i) => {
        data[header] = values[i] || '';
      });

      return {
        id: `row-${index}`,
        data,
        status: 'pending',
      };
    });

    return { headers, rows, fileName };
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsedData = parseCSV(text, file.name);
      onDataChange(parsedData);
    };
    reader.readAsText(file);
  }, [parseCSV, onDataChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const handleRowClick = useCallback((rowId: string) => {
    if (!onRowSelect) return;
    
    const newSelection = selectedRows.includes(rowId)
      ? selectedRows.filter(id => id !== rowId)
      : [...selectedRows, rowId];
    
    onRowSelect(newSelection);
  }, [selectedRows, onRowSelect]);

  const handleSelectAll = useCallback(() => {
    if (!data || !onRowSelect) return;
    
    if (selectedRows.length === data.rows.length) {
      onRowSelect([]);
    } else {
      onRowSelect(data.rows.map(row => row.id));
    }
  }, [data, selectedRows, onRowSelect]);

  const sortedRows = data?.rows.slice().sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a.data[sortColumn] || '';
    const bVal = b.data[sortColumn] || '';
    const comparison = aVal.localeCompare(bVal);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getRowStatusColor = (row: SpreadsheetRow) => {
    if (processingRows.includes(row.id)) return 'border-l-4 border-l-heat bg-heat/5';
    switch (row.status) {
      case 'completed': return 'border-l-4 border-l-success bg-success/5';
      case 'error': return 'border-l-4 border-l-danger bg-danger/5';
      case 'processing': return 'border-l-4 border-l-heat bg-heat/5';
      default: return '';
    }
  };

  // Empty state - file upload
  if (!data) {
    return (
      <div className="card h-full flex flex-col">
        <h3 className="font-display font-semibold text-lg text-void-100 flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Spreadsheet Data
        </h3>
        
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex-1 flex flex-col items-center justify-center
            border-2 border-dashed rounded-xl cursor-pointer
            transition-all duration-300
            ${isDragging 
              ? 'border-pulse bg-pulse/10 scale-[1.02]' 
              : 'border-void-600 hover:border-void-500 hover:bg-void-800/30'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
          
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center mb-4
            transition-all duration-300
            ${isDragging ? 'bg-pulse/20 text-pulse' : 'bg-void-800 text-void-400'}
          `}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <p className="font-display font-medium text-void-200 mb-1">
            {isDragging ? 'Drop your CSV file here' : 'Upload CSV file'}
          </p>
          <p className="text-sm text-void-400">
            Drag and drop or click to browse
          </p>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {data.fileName}
          </h3>
          <p className="text-sm text-void-400">
            {data.rows.length} rows · {data.headers.length} columns
            {selectedRows.length > 0 && ` · ${selectedRows.length} selected`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-sm px-3 py-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button
            onClick={() => onDataChange(null as unknown as SpreadsheetData)}
            className="btn-secondary text-sm px-3 py-2 text-danger hover:text-danger"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar rounded-lg border border-void-700">
        <table className="w-full min-w-max">
          <thead className="bg-void-800/80 sticky top-0">
            <tr>
              <th className="table-header w-10">
                <input
                  type="checkbox"
                  checked={selectedRows.length === data.rows.length && data.rows.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-void-600 bg-void-800 text-pulse focus:ring-pulse/50"
                />
              </th>
              <th className="table-header w-10">#</th>
              {data.headers.map((header) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  className="table-header cursor-pointer hover:text-pulse transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    {header}
                    <svg
                      className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                        sortColumn === header ? 'opacity-100 text-pulse' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      {sortColumn === header && sortDirection === 'desc' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      )}
                    </svg>
                  </div>
                </th>
              ))}
              <th className="table-header w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows?.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row.id)}
                className={`
                  table-row cursor-pointer
                  ${selectedRows.includes(row.id) ? 'bg-pulse/10' : ''}
                  ${getRowStatusColor(row)}
                `}
              >
                <td className="table-cell">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => handleRowClick(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-void-600 bg-void-800 text-pulse focus:ring-pulse/50"
                  />
                </td>
                <td className="table-cell text-void-500 font-mono text-xs">
                  {index + 1}
                </td>
                {data.headers.map((header) => (
                  <td key={header} className="table-cell max-w-[200px] truncate">
                    {row.data[header]}
                  </td>
                ))}
                <td className="table-cell">
                  <StatusBadge status={row.status} isProcessing={processingRows.includes(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ 
  status, 
  isProcessing 
}: { 
  status: SpreadsheetRow['status']; 
  isProcessing: boolean;
}) {
  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-heat/20 text-heat">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Processing
      </span>
    );
  }

  const styles = {
    pending: 'bg-void-700/50 text-void-400',
    processing: 'bg-heat/20 text-heat',
    completed: 'bg-success/20 text-success',
    error: 'bg-danger/20 text-danger',
  };

  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Done',
    error: 'Error',
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

