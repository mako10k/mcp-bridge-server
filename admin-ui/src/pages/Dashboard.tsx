import { useEffect, useState } from 'react';
import { RefreshCw, Server, Wrench, CheckCircle } from 'lucide-react';
import type { MCPServer } from '../types';
import api from '../services/api';

interface StatsData {
  totalServers: number;
  connectedServers: number;
  totalTools: number;
}

export default function Dashboard() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalServers: 0, connectedServers: 0, totalTools: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch server details
        const serversResponse = await api.get('/mcp/servers');
        const serversData = serversResponse.data;
        const serverList = serversData.servers || [];

        // Fetch tools count
        const toolsResponse = await api.get('/mcp/tools');
        const toolsData = toolsResponse.data;
        const toolCount = toolsData.tools?.length || 0;

        setServers(serverList);
        setStats({
          totalServers: serverList.length,
          connectedServers: serverList.filter((s: MCPServer) => s.statusInfo.status === 'connected').length,
          totalTools: toolCount,
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh data every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading MCP Bridge...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your MCP Bridge Server status and performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Server className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Servers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalServers}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Connected</p>
              <p className="text-2xl font-bold text-gray-900">{stats.connectedServers}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Wrench className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Tools</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTools}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Servers */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Server Status</h3>
        </div>
        <div className="p-6">
          {servers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No servers configured</p>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <div 
                  key={server.id} 
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    server.statusInfo.status === 'connected' ? 'bg-green-50' : 
                    server.statusInfo.status === 'connecting' || server.statusInfo.status === 'retrying' ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      server.statusInfo.status === 'connected' ? 'bg-green-500' :
                      server.statusInfo.status === 'connecting' || server.statusInfo.status === 'retrying' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{server.name}</p>
                      <p className="text-sm text-gray-500">ID: {server.id}</p>
                      <p className="text-xs text-gray-400">
                        Transport: {server.transport} | {server.connected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium capitalize ${
                      server.statusInfo.status === 'connected' ? 'text-green-700' :
                      server.statusInfo.status === 'connecting' || server.statusInfo.status === 'retrying' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {server.statusInfo.status || 'disconnected'}
                    </p>
                    {server.statusInfo.lastRetryTime && (
                      <p className="text-xs text-gray-500">
                        Last retry: {new Date(server.statusInfo.lastRetryTime).toLocaleTimeString()}
                      </p>
                    )}
                    {server.statusInfo.errorMessage && (
                      <p className="text-xs text-red-500">
                        Error: {server.statusInfo.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">System Status</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Server Health</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Connection Rate</span>
                  <span className="font-medium">
                    {stats.totalServers ? 
                      Math.round((stats.connectedServers / stats.totalServers) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${stats.totalServers ? 
                        (stats.connectedServers / stats.totalServers) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Tool Discovery</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tools Available</span>
                  <span className="font-medium">{stats.totalTools}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Auto Discovery</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Ready!</strong> The MCP Bridge Server is running and connected to {stats.connectedServers} out of {stats.totalServers} servers.
              <br />
              <span className="text-xs text-gray-500">
                Auto tool discovery is active with {stats.totalTools} tools registered.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
