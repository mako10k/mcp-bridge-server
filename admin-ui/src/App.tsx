import { useEffect, useState } from 'react';

interface ServerData {
  id: string;
  name: string;
  status: {
    status: string;
    retryCount: number;
    connectedAt?: string;
    errorMessage?: string;
  };
}

interface StatsData {
  totalServers: number;
  connectedServers: number;
  totalTools: number;
}

function App() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalServers: 0, connectedServers: 0, totalTools: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch server list first
        const serversResponse = await fetch('http://localhost:3000/mcp/servers');
        const serversData = await serversResponse.json();
        const serverIds = serversData.servers || [];

        // Fetch detailed status for each server
        const serverDetails = await Promise.all(
          serverIds.map(async (serverId: string) => {
            try {
              const statusResponse = await fetch(`http://localhost:3000/mcp/servers/${serverId}/status`);
              const statusData = await statusResponse.json();
              return {
                id: serverId,
                name: serverId,
                status: statusData.status
              };
            } catch (error) {
              console.error(`Failed to fetch status for ${serverId}:`, error);
              return {
                id: serverId,
                name: serverId,
                status: { status: 'unknown', retryCount: 0 }
              };
            }
          })
        );

        setServers(serverDetails);

        // Fetch tools
        const toolsResponse = await fetch('http://localhost:3000/mcp/tools');
        const toolsData = await toolsResponse.json();
        
        // Calculate stats
        const totalServers = serverDetails.length;
        const connectedServers = serverDetails.filter(s => s.status.status === 'connected').length;
        const totalTools = toolsData.tools?.length || 0;
        
        setStats({ totalServers, connectedServers, totalTools });
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MCP Bridge...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">MCP Bridge Admin UI</h1>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Servers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalServers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Connected</p>
                <p className="text-2xl font-bold text-gray-900">{stats.connectedServers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">T</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tools</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTools}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">MCP Bridge Status</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {servers.map((server) => (
                <div 
                  key={server.id} 
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    server.status.status === 'connected' ? 'bg-green-50' : 
                    server.status.status === 'connecting' || server.status.status === 'retrying' ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      server.status.status === 'connected' ? 'bg-green-500' :
                      server.status.status === 'connecting' || server.status.status === 'retrying' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className="font-medium text-gray-900">{server.name}</span>
                    <span className="text-sm text-gray-500">({server.id})</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm capitalize ${
                      server.status.status === 'connected' ? 'text-green-700' :
                      server.status.status === 'connecting' || server.status.status === 'retrying' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {server.status.status}
                    </span>
                    {server.status.connectedAt && (
                      <p className="text-xs text-gray-500">
                        Connected {new Date(server.status.connectedAt).toLocaleTimeString()}
                      </p>
                    )}
                    {server.status.errorMessage && (
                      <p className="text-xs text-red-500">
                        Error: {server.status.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {servers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No servers configured</p>
                </div>
              )}
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
    </div>
  );
}

export default App;
