import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings } from 'lucide-react';
import { MCPBridgeService } from '../services/mcpBridge';
import type { GlobalConfig } from '../types';

const mcpBridge = new MCPBridgeService();

export default function GlobalSettings() {
  const [config, setConfig] = useState<GlobalConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchGlobalConfig();
  }, []);

  const fetchGlobalConfig = async () => {
    try {
      setLoading(true);
      const globalConfig = await mcpBridge.getGlobalConfig();
      setConfig(globalConfig);
    } catch (error) {
      console.error('Error fetching global config:', error);
      setMessage({ type: 'error', text: 'Failed to load global configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Check if port has changed
      const currentConfig = await mcpBridge.getGlobalConfig();
      const portChanged = currentConfig.httpPort !== config.httpPort;
      
      await mcpBridge.updateGlobalConfig(config);
      
      if (portChanged) {
        setMessage({ 
          type: 'success', 
          text: 'Global configuration saved successfully. Server will automatically restart on the new port. Note: Other MCP clients may need to be reconfigured to use the new port.' 
        });
      } else {
        setMessage({ type: 'success', text: 'Global configuration saved successfully' });
      }
      
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error saving global config:', error);
      setMessage({ type: 'error', text: 'Failed to save global configuration' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof GlobalConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading global settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Global Settings</h1>
        <p className="text-gray-600">
          Configure global MCP Bridge settings and preferences
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Server Configuration
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* HTTP Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTTP Port
            </label>
            <input
              type="number"
              min="1"
              max="65535"
              value={config.httpPort || 3000}
              onChange={(e) => updateConfig('httpPort', parseInt(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-1 text-sm text-gray-500">
              <p>Port number for the MCP Bridge HTTP server (default: 3000)</p>
              <p className="text-amber-600 font-medium">⚠️ Port changes will automatically restart the server. Other MCP clients may need reconfiguration.</p>
            </div>
          </div>

          {/* Log Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Log Level
            </label>
            <select
              value={config.logLevel || 'info'}
              onChange={(e) => updateConfig('logLevel', e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Minimum log level to display in console and logs
            </p>
          </div>

          {/* Max Concurrent Connections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Concurrent Connections
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={config.maxConcurrentConnections || 10}
              onChange={(e) => updateConfig('maxConcurrentConnections', parseInt(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Maximum number of concurrent MCP server connections (default: 10)
            </p>
          </div>

          {/* Request Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Timeout (ms)
            </label>
            <input
              type="number"
              min="1000"
              max="300000"
              step="1000"
              value={config.requestTimeout || 30000}
              onChange={(e) => updateConfig('requestTimeout', parseInt(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Timeout for MCP server requests in milliseconds (default: 30000)
            </p>
          </div>

          {/* Fix Invalid Tool Schemas */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.fixInvalidToolSchemas || false}
                onChange={(e) => updateConfig('fixInvalidToolSchemas', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Auto-fix Invalid Tool Schemas
              </span>
            </label>
            <p className="mt-1 ml-6 text-sm text-gray-500">
              Automatically fix tool schemas missing required fields instead of rejecting them
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={fetchGlobalConfig}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
