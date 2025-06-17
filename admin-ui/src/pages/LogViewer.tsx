import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Download, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import api from '../services/api';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  args?: any[];
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [limit, setLimit] = useState(500);

  const fetchLogs = async () => {
    try {
      setError(null);
      const response = await api.get(`/mcp/logs?limit=${limit}`);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setError('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      setError(null);
      await api.delete('/mcp/logs');
      setLogs([]);
      alert('Logs cleared successfully');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      setError('Failed to clear logs');
    }
  };

  const downloadLogs = () => {
    const logsText = logs.map(log => 
      `[${log.timestamp}] [${log.level}] ${log.message}${log.args ? ` ${JSON.stringify(log.args)}` : ''}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ERROR': return <X className="h-4 w-4 text-red-500" />;
      case 'WARN': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'INFO': return <Info className="h-4 w-4 text-blue-500" />;
      case 'DEBUG': return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'ERROR': return 'bg-red-50 border-l-red-500 text-red-800';
      case 'WARN': return 'bg-yellow-50 border-l-yellow-500 text-yellow-800';
      case 'INFO': return 'bg-blue-50 border-l-blue-500 text-blue-800';
      case 'DEBUG': return 'bg-gray-50 border-l-gray-500 text-gray-600';
      default: return 'bg-gray-50 border-l-gray-500 text-gray-600';
    }
  };

  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(log => log.level === filter);

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, limit]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Viewer</h1>
        <p className="mt-1 text-sm text-gray-500">
          View system logs and server activities
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="btn btn-primary flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2 text-sm text-gray-700">Auto refresh</span>
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="form-select"
            >
              <option value="ALL">All Levels</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
            </select>

            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="form-select"
            >
              <option value="100">Last 100</option>
              <option value="500">Last 500</option>
              <option value="1000">Last 1000</option>
            </select>

            <button
              onClick={downloadLogs}
              className="btn btn-secondary flex items-center"
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>

            <button
              onClick={clearLogs}
              className="btn btn-danger flex items-center"
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Logs ({filteredLogs.length})
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No logs found</p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`border-l-4 p-3 rounded-r ${getLogLevelClass(log.level)}`}
                >
                  <div className="flex items-start">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {getLogIcon(log.level)}
                      <span className="text-xs font-mono text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold">
                        {log.level}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-sm">
                    {log.message}
                    {log.args && log.args.length > 0 && (
                      <div className="mt-1 text-xs font-mono bg-gray-100 p-2 rounded">
                        {JSON.stringify(log.args, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
