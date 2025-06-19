import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, Power, RotateCcw, Copy, ExternalLink, Code } from 'lucide-react';
import { MCPBridgeService } from '../services/mcpBridge';
import api from '../services/api';
import type { GlobalConfig } from '../types';

const mcpBridge = new MCPBridgeService();

export default function GlobalSettings() {
  const [config, setConfig] = useState<GlobalConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copyMessages, setCopyMessages] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchGlobalConfig();
  }, []);

  const fetchGlobalConfig = async () => {
    try {
      setLoading(true);
      const globalConfig = await mcpBridge.getGlobalConfig();
      const network = await mcpBridge.getNetworkSecurity();
      setConfig({ ...globalConfig, security: { network } });
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
      if (config.security?.network) {
        await mcpBridge.updateNetworkSecurity(config.security.network);
      }
      
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

  const updateNetworkSecurity = (
    key: 'listenAddress' | 'allowExternalAccess',
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      security: {
        ...prev.security,
        network: {
          ...prev.security?.network,
          [key]: value
        }
      }
    }));
  };

  const handleRestartServer = async () => {
    setShowRestartConfirm(false);
    setRestarting(true);
    try {
      const response = await api.post('/mcp/server/restart');
      
      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: 'MCP Bridge Server restart initiated. The server will restart shortly.' 
        });
        
        // Reload the page after a short delay to reconnect to the restarted server
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Failed to restart server' });
      }
    } catch (error) {
      console.error('Error restarting server:', error);
      setMessage({ type: 'error', text: 'Failed to restart server' });
    } finally {
      setRestarting(false);
    }
  };

  const handleShutdownServer = async () => {
    setShowShutdownConfirm(false);
    setShuttingDown(true);
    try {
      const response = await api.post('/mcp/server/shutdown');
      
      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: 'MCP Bridge Server shutdown initiated. The admin UI will be unavailable until the server is manually restarted.' 
        });
        
        // Show a final message before the server shuts down
        setTimeout(() => {
          alert('MCP Bridge Server is shutting down. This page will become unavailable.');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Failed to shutdown server' });
      }
    } catch (error) {
      console.error('Error shutting down server:', error);
      setMessage({ type: 'error', text: 'Failed to shutdown server' });
    } finally {
      setShuttingDown(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessages(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyMessages(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getServerEndpoint = () => {
    return `http://localhost:${config.httpPort || 3000}/mcp`;
  };

  const getClaudeDesktopConfig = () => {
    return JSON.stringify({
      "mcpServers": {
        "mcp-bridge": {
          "command": "curl",
          "args": [
            "-X", "POST",
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json",
            getServerEndpoint()
          ]
        }
      }
    }, null, 2);
  };

  const getVSCodeUserSettingsConfig = () => {
    return JSON.stringify({
      "mcp": {
        "servers": {
          "mcp-bridge": {
            "type": "http",
            "url": getServerEndpoint()
          }
        }
      }
    }, null, 2);
  };

  const getVSCodeWorkspaceConfig = () => {
    return JSON.stringify({
      "servers": {
        "mcp-bridge": {
          "type": "http",
          "url": getServerEndpoint()
        }
      }
    }, null, 2);
  };

  const getContinueDevConfig = () => {
    return `contextProviders:
  - name: mcp
    params:
      serverName: "mcp-bridge"
      url: "${getServerEndpoint()}"
      transport: "http"`;
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

          {/* Listen Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listen Address
            </label>
            <input
              type="text"
              value={config.security?.network?.listenAddress || '127.0.0.1'}
              onChange={(e) => updateNetworkSecurity('listenAddress', e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Address to bind the HTTP server (e.g., 127.0.0.1)
            </p>
          </div>

          {/* Allow External Access */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.security?.network?.allowExternalAccess || false}
                onChange={(e) => updateNetworkSecurity('allowExternalAccess', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Allow External Access
              </span>
            </label>
            <p className="mt-1 ml-6 text-sm text-gray-500">
              Enable network access from non-localhost addresses when authentication is enabled.
            </p>
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

      {/* MCP Configuration Section */}
      <div className="mt-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Code className="h-5 w-5 mr-2" />
              MCP Server Configuration
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Connect this MCP Bridge to various clients like Claude Desktop, VS Code, Continue.dev, etc.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Server Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MCP Server Endpoint
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={getServerEndpoint()}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(getServerEndpoint(), 'endpoint')}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copyMessages['endpoint'] ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Use this HTTP endpoint to connect MCP clients to this bridge server.
              </p>
            </div>

            {/* Claude Desktop Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Claude Desktop Configuration
                </label>
                <a
                  href="https://modelcontextprotocol.io/quickstart/user"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Official Guide
                </a>
              </div>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{getClaudeDesktopConfig()}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(getClaudeDesktopConfig(), 'claude')}
                  className="absolute top-2 right-2 inline-flex items-center px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copyMessages['claude'] ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Add this to your <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code> file:
                <br />
                <strong>macOS:</strong> <code className="bg-gray-100 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                <br />
                <strong>Windows:</strong> <code className="bg-gray-100 px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code>
              </p>
            </div>

            {/* VS Code Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  VS Code MCP Configuration
                </label>
                <a
                  href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  VS Code MCP Docs
                </a>
              </div>

              {/* User Settings Option */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Option 1: User Settings (Global)</h4>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{getVSCodeUserSettingsConfig()}</code>
                  </pre>
                  <button
                    onClick={() => copyToClipboard(getVSCodeUserSettingsConfig(), 'vscode-user')}
                    className="absolute top-2 right-2 inline-flex items-center px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copyMessages['vscode-user'] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Add this to your VS Code <strong>User Settings</strong> (<code className="bg-gray-100 px-1 rounded">settings.json</code>).
                  This applies to all workspaces.
                </p>
              </div>

              {/* Workspace Settings Option */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Option 2: Workspace Settings (Project-specific)</h4>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{getVSCodeWorkspaceConfig()}</code>
                  </pre>
                  <button
                    onClick={() => copyToClipboard(getVSCodeWorkspaceConfig(), 'vscode-workspace')}
                    className="absolute top-2 right-2 inline-flex items-center px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copyMessages['vscode-workspace'] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Create <code className="bg-gray-100 px-1 rounded">.vscode/mcp.json</code> file in your workspace folder.
                  This applies only to the specific project and can be shared with team members.
                </p>
              </div>
              
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Prerequisites:</strong> Enable MCP support with <code className="bg-amber-100 px-1 rounded">chat.mcp.enabled: true</code> 
                  and agent mode with <code className="bg-amber-100 px-1 rounded">chat.agent.enabled: true</code> in VS Code settings.
                </p>
              </div>
            </div>

            {/* Continue.dev Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Continue.dev Configuration
                </label>
                <a
                  href="https://docs.continue.dev/reference"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Continue.dev Docs
                </a>
              </div>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{getContinueDevConfig()}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(getContinueDevConfig(), 'continue')}
                  className="absolute top-2 right-2 inline-flex items-center px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copyMessages['continue'] ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Add this to your Continue.dev <code className="bg-gray-100 px-1 rounded">config.yaml</code> file to use MCP context providers.
              </p>
            </div>

            {/* General Notes */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Important Notes</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Restart your MCP client after updating configuration files</li>
                <li>• Ensure this MCP Bridge server is running when using clients</li>
                <li>• Port changes require updating client configurations</li>
                <li>• Check client-specific documentation for the latest setup instructions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Server Management */}
      <div className="mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Power className="h-5 w-5 mr-2" />
            Server Management
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Restart Server */}
          <div>
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart Server
            </button>
            <p className="mt-1 text-sm text-gray-500">
              Restart the MCP Bridge server. Useful for applying configuration changes.
            </p>
          </div>

          {/* Shutdown Server */}
          <div>
            <button
              onClick={() => setShowShutdownConfirm(true)}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Power className="h-4 w-4 mr-2" />
              Shutdown Server
            </button>
            <p className="mt-1 text-sm text-gray-500">
              Shutdown the MCP Bridge server. It will stop all running processes.
            </p>
          </div>
        </div>
      </div>

      {/* Confirm Modals */}
      {showRestartConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Restart
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to restart the server? This will apply any configuration changes.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRestartServer}
                disabled={restarting}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                {restarting ? 'Restarting...' : 'Restart Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShutdownConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Shutdown
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to shutdown the server? This will stop all running processes.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowShutdownConfirm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleShutdownServer}
                disabled={shuttingDown}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {shuttingDown ? 'Shutting down...' : 'Shutdown Server'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
