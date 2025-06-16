import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Search, Edit2, Tag, Bot } from 'lucide-react';
import { MCPBridgeService } from '../services/mcpBridge';
import type { ToolAlias, MCPServer, Tool } from '../types';

const mcpBridge = new MCPBridgeService();

export default function ToolManagement() {
  const [explicitAliases, setExplicitAliases] = useState<ToolAlias[]>([]);
  const [autoDiscoveryTools, setAutoDiscoveryTools] = useState<ToolAlias[]>([]);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [availableTools, setAvailableTools] = useState<{ [serverId: string]: Tool[] }>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    serverId: '',
    toolName: '',
    newName: ''
  });
  const [editForm, setEditForm] = useState({
    oldName: '',
    newName: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServer, setSelectedServer] = useState('all');
  const [activeTab, setActiveTab] = useState<'explicit' | 'auto-discovery'>('explicit');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch explicit aliases and auto-discovery tools separately
      const [explicitTools, autoTools, serversData, allTools] = await Promise.all([
        mcpBridge.getExplicitToolAliases(),
        mcpBridge.getAutoDiscoveryTools(),
        mcpBridge.getServers(),
        mcpBridge.getTools()
      ]);

      setExplicitAliases(explicitTools);
      setAutoDiscoveryTools(autoTools);
      setServers(serversData);

      // Group available tools by server
      const toolsByServer: { [serverId: string]: Tool[] } = {};
      allTools.forEach(tool => {
        if (tool.serverId) {
          if (!toolsByServer[tool.serverId]) {
            toolsByServer[tool.serverId] = [];
          }
          toolsByServer[tool.serverId].push(tool);
        }
      });
      setAvailableTools(toolsByServer);

    } catch (error) {
      console.error('Error fetching tool management data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlias = async () => {
    if (!formData.serverId || !formData.toolName || !formData.newName) {
      alert('All fields are required');
      return;
    }

    try {
      await mcpBridge.createToolAlias(formData.newName, formData.toolName, formData.serverId);
      setShowAddForm(false);
      setFormData({ serverId: '', toolName: '', newName: '' });
      await fetchData();
    } catch (error) {
      console.error('Error creating tool alias:', error);
      alert('Failed to create tool alias');
    }
  };

  const handleUpdateAlias = async () => {
    if (!editForm.oldName || !editForm.newName) {
      alert('Both old name and new name are required');
      return;
    }

    try {
      await mcpBridge.updateToolAlias(editForm.oldName, editForm.newName);
      setEditingAlias(null);
      setEditForm({ oldName: '', newName: '' });
      await fetchData();
    } catch (error) {
      console.error('Error updating tool alias:', error);
      alert('Failed to update tool alias');
    }
  };

  const handleRemoveAlias = async (aliasName: string) => {
    if (!confirm(`Are you sure you want to remove the alias "${aliasName}"?`)) {
      return;
    }

    try {
      await mcpBridge.removeToolAlias(aliasName);
      await fetchData();
    } catch (error) {
      console.error('Error removing tool alias:', error);
      alert('Failed to remove tool alias');
    }
  };

  const startEdit = (alias: ToolAlias) => {
    setEditingAlias(alias.alias);
    setEditForm({ oldName: alias.alias, newName: alias.alias });
  };

  const cancelEdit = () => {
    setEditingAlias(null);
    setEditForm({ oldName: '', newName: '' });
  };

  const filteredExplicitAliases = explicitAliases.filter(alias => {
    const matchesSearch = alias.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alias.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesServer = selectedServer === 'all' || alias.serverId === selectedServer;
    return matchesSearch && matchesServer;
  });

  const filteredAutoDiscoveryTools = autoDiscoveryTools.filter(alias => {
    const matchesSearch = alias.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alias.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesServer = selectedServer === 'all' || alias.serverId === selectedServer;
    return matchesSearch && matchesServer;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading tool management...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tool Management</h1>
        <p className="text-gray-600">
          Manage tool aliases and auto-discovery settings for MCP servers
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Alias
        </button>
        
        <button
          onClick={fetchData}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={selectedServer}
          onChange={(e) => setSelectedServer(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Servers</option>
          {servers.map(server => (
            <option key={server.id} value={server.id}>{server.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('explicit')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'explicit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="h-4 w-4 inline mr-2" />
              Explicit Aliases ({filteredExplicitAliases.length})
            </button>
            <button
              onClick={() => setActiveTab('auto-discovery')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'auto-discovery'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Bot className="h-4 w-4 inline mr-2" />
              Auto-Discovery Tools ({filteredAutoDiscoveryTools.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Tool Lists */}
      {activeTab === 'explicit' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Explicit Tool Aliases</h2>
            <p className="text-sm text-gray-600">
              Manually created aliases that can be renamed or removed
            </p>
          </div>

          {filteredExplicitAliases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No explicit tool aliases found</p>
              <p className="text-sm">Create one using the "Add Alias" button above</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alias Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Tool
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExplicitAliases.map((alias) => (
                    <tr key={alias.alias}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingAlias === alias.alias ? (
                          <input
                            type="text"
                            value={editForm.newName}
                            onChange={(e) => setEditForm({ ...editForm, newName: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{alias.alias}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{alias.originalName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {alias.serverId}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingAlias === alias.alias ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUpdateAlias}
                              className="text-green-600 hover:text-green-900"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(alias)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveAlias(alias.alias)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Auto-Discovery Tools</h2>
            <p className="text-sm text-gray-600">
              Automatically discovered tools based on discovery rules
            </p>
          </div>

          {filteredAutoDiscoveryTools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No auto-discovery tools found</p>
              <p className="text-sm">Check your auto-discovery settings in global configuration</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tool Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Tool
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAutoDiscoveryTools.map((tool) => (
                    <tr key={`${tool.serverId}:${tool.originalName}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{tool.alias}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tool.originalName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {tool.serverId}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Auto-discovered
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Tool Alias</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server
                </label>
                <select
                  value={formData.serverId}
                  onChange={(e) => setFormData({ ...formData, serverId: e.target.value, toolName: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select server...</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>{server.name}</option>
                  ))}
                </select>
              </div>

              {formData.serverId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tool
                  </label>
                  <select
                    value={formData.toolName}
                    onChange={(e) => setFormData({ ...formData, toolName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select tool...</option>
                    {(availableTools[formData.serverId] || []).map(tool => (
                      <option key={tool.name} value={tool.name}>{tool.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alias Name
                </label>
                <input
                  type="text"
                  value={formData.newName}
                  onChange={(e) => setFormData({ ...formData, newName: e.target.value })}
                  placeholder="Enter alias name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAlias}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Alias
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
