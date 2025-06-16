import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit, Trash2, Power, AlertCircle, CheckCircle } from 'lucide-react';

interface ServerData {
  id: string;
  name: string;
  displayName?: string;
  transport: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status?: {
    status: string;
    retryCount: number;
    connectedAt?: string;
    errorMessage?: string;
  };
}

interface ServerConfig {
  name: string;
  displayName?: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

interface EnvVar {
  key: string;
  value: string;
}

export default function ServerManagement() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServerConfig>({
    name: '',
    command: '',
    args: [],
    cwd: '',
    env: {},
    transport: 'stdio'
  });
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      // Fetch all server configurations
      const configResponse = await fetch('http://localhost:3000/mcp/config/servers');
      const configData = await configResponse.json();
      const allServers = configData.servers || [];

      // Fetch server statuses
      const serversResponse = await fetch('http://localhost:3000/mcp/servers');
      const serversData = await serversResponse.json();
      const connectedServerIds = serversData.servers || [];

      // Combine configuration and status data
      const serverDetails = await Promise.all(
        allServers.map(async (serverConfig: any) => {
          const serverId = serverConfig.name;
          let status = { status: 'disconnected', retryCount: 0 };

          // If server is connected, fetch detailed status
          if (connectedServerIds.includes(serverId)) {
            try {
              const statusResponse = await fetch(`http://localhost:3000/mcp/servers/${serverId}/status`);
              const statusData = await statusResponse.json();
              status = statusData.status;
            } catch (error) {
              console.error(`Failed to fetch status for ${serverId}:`, error);
            }
          }

          return {
            id: serverId,
            name: serverId,
            displayName: serverConfig.displayName,
            transport: serverConfig.transport,
            command: serverConfig.command,
            args: serverConfig.args,
            cwd: serverConfig.cwd,
            env: serverConfig.env,
            enabled: serverConfig.enabled,
            status
          };
        })
      );

      setServers(serverDetails);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/mcp/config/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId: formData.name.toLowerCase().replace(/\s+/g, '-'),
          config: formData
        }),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({ name: '', command: '', args: [], cwd: '', env: {}, transport: 'stdio' });
        setEnvVars([]);
        fetchServers();
      } else {
        console.error('Failed to add server');
      }
    } catch (error) {
      console.error('Error adding server:', error);
    }
  };

  const handleEditServer = (server: ServerData) => {
    setEditingServer(server.id);
    setShowAddForm(true);
    setFormData({
      name: server.name,
      displayName: server.displayName,
      transport: server.transport as 'stdio' | 'http',
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: server.env || {},
      enabled: server.enabled
    });
    
    // Convert env object to EnvVar array
    const envArray: EnvVar[] = Object.entries(server.env || {}).map(([key, value]) => ({
      key,
      value
    }));
    setEnvVars(envArray);
  };

  const handleUpdateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;

    try {
      const response = await fetch(`http://localhost:3000/mcp/config/servers/${editingServer}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: formData
        }),
      });

      if (response.ok) {
        setEditingServer(null);
        setShowAddForm(false);
        setFormData({ name: '', command: '', args: [], cwd: '', env: {}, transport: 'stdio' });
        setEnvVars([]);
        fetchServers();
      } else {
        console.error('Failed to update server');
      }
    } catch (error) {
      console.error('Error updating server:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
    setShowAddForm(false);
    setFormData({ name: '', command: '', args: [], cwd: '', env: {}, transport: 'stdio' });
    setEnvVars([]);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
    
    // Update formData.env
    const env: Record<string, string> = {};
    updated.forEach(envVar => {
      if (envVar.key.trim()) {
        env[envVar.key] = envVar.value;
      }
    });
    setFormData({ ...formData, env });
  };

  const removeEnvVar = (index: number) => {
    const updated = envVars.filter((_, i) => i !== index);
    setEnvVars(updated);
    
    // Update formData.env
    const env: Record<string, string> = {};
    updated.forEach(envVar => {
      if (envVar.key.trim()) {
        env[envVar.key] = envVar.value;
      }
    });
    setFormData({ ...formData, env });
  };

  const handleRemoveServer = async (serverId: string) => {
    if (!confirm(`Are you sure you want to remove server "${serverId}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/mcp/config/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchServers();
      } else {
        console.error('Failed to remove server');
      }
    } catch (error) {
      console.error('Error removing server:', error);
    }
  };

  const handleRetryServer = async (serverId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/mcp/servers/${serverId}/retry`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchServers();
      } else {
        console.error('Failed to retry server');
      }
    } catch (error) {
      console.error('Error retrying server:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Server Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your MCP servers and their configurations
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingServer(null);
            setEnvVars([]);
            setFormData({ name: '', command: '', args: [], cwd: '', env: {}, transport: 'stdio' });
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </button>
      </div>

      {/* Add/Edit Server Form */}
      {showAddForm && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingServer ? 'Edit Server' : 'Add New Server'}
          </h3>
          <form onSubmit={editingServer ? handleUpdateServer : handleAddServer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Server Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My MCP Server"
                  required
                  disabled={!!editingServer}
                />
              </div>
              <div>
                <label className="label">Display Name (optional)</label>
                <input
                  type="text"
                  className="input"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g., My MCP Server"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Transport</label>
                <select
                  className="input"
                  value={formData.transport}
                  onChange={(e) => setFormData({ ...formData, transport: e.target.value as 'stdio' | 'http' })}
                >
                  <option value="stdio">STDIO</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
              {formData.transport === 'stdio' && (
                <div>
                  <label className="label">Command</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.command || ''}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    placeholder="e.g., node, python, npx"
                    required
                  />
                </div>
              )}
            </div>
            
            {formData.transport === 'stdio' && (
              <div>
                <label className="label">Arguments (one per line)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.args?.join('\n') || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    args: e.target.value.split('\n').filter(arg => arg.trim()) 
                  })}
                  placeholder="e.g., server.js&#10;--port&#10;3001"
                />
              </div>
            )}

            {formData.transport === 'http' && (
              <div>
                <label className="label">URL</label>
                <input
                  type="url"
                  className="input"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="e.g., http://localhost:3001/mcp"
                  required
                />
              </div>
            )}

            <div>
              <label className="label">Working Directory (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.cwd || ''}
                onChange={(e) => setFormData({ ...formData, cwd: e.target.value })}
                placeholder="e.g., /path/to/server"
              />
            </div>

            {/* Environment Variables */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="label">Environment Variables</label>
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="btn btn-secondary text-sm"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Variable
                </button>
              </div>
              {envVars.map((envVar, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Variable name"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Variable value"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index)}
                    className="btn btn-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingServer ? 'Update Server' : 'Add Server'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Servers List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Configured Servers</h3>
          <button
            onClick={fetchServers}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {servers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No servers configured</p>
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingServer(null);
                  setEnvVars([]);
                  setFormData({ name: '', command: '', args: [], cwd: '', env: {}, transport: 'stdio' });
                }}
                className="mt-2 btn btn-primary"
              >
                Add your first server
              </button>
            </div>
          ) : (
            servers.map((server) => (
              <div key={server.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {server.status?.status === 'connected' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : server.status?.status === 'connecting' || server.status?.status === 'retrying' ? (
                        <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{server.displayName || server.name}</h4>
                      <p className="text-sm text-gray-500">ID: {server.id}</p>
                      <p className={`text-sm capitalize ${
                        server.status?.status === 'connected' ? 'text-green-600' :
                        server.status?.status === 'connecting' || server.status?.status === 'retrying' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        Status: {server.status?.status || 'disconnected'}
                      </p>
                      {server.status?.errorMessage && (
                        <p className="text-sm text-red-500">Error: {server.status.errorMessage}</p>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        <p>Transport: {server.transport} | Command: {server.command || 'N/A'}</p>
                        {server.env && Object.keys(server.env).length > 0 && (
                          <p>Environment variables: {Object.keys(server.env).join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {(server.status?.status === 'failed' || server.status?.status === 'disconnected') && (
                      <button
                        onClick={() => handleRetryServer(server.id)}
                        className="btn btn-secondary flex items-center"
                        title="Retry connection"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditServer(server)}
                      className="btn btn-secondary flex items-center"
                      title="Edit server"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveServer(server.id)}
                      className="btn btn-danger flex items-center"
                      title="Remove server"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {server.status?.connectedAt && (
                  <div className="mt-3 text-xs text-gray-500">
                    Connected at: {new Date(server.status.connectedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}