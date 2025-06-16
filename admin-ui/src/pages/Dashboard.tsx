import { useStats, useServers } from '../services/hooks';
import { RefreshCw, Server, Wrench, AlertCircle, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: servers, isLoading: serversLoading } = useServers();

  if (statsLoading || serversLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const recentServers = servers?.slice(0, 5) || [];

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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Server className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Servers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalServers || 0}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats?.connectedServers || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.failedServers || 0}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats?.totalTools || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Servers */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Servers</h3>
        </div>
        <div className="p-6">
          {recentServers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No servers configured</p>
          ) : (
            <div className="space-y-4">
              {recentServers.map((server) => (
                <div key={server.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      server.status.state === 'connected' ? 'bg-green-500' :
                      server.status.state === 'connecting' || server.status.state === 'retrying' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{server.name}</p>
                      <p className="text-sm text-gray-500">{server.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {server.status.state}
                    </p>
                    {server.status.connectedAt && (
                      <p className="text-xs text-gray-500">
                        Connected {new Date(server.status.connectedAt).toLocaleTimeString()}
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
                    {stats?.totalServers ? 
                      Math.round((stats.connectedServers / stats.totalServers) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${stats?.totalServers ? 
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
                  <span className="font-medium">{stats?.totalTools || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Aliased Tools</span>
                  <span className="font-medium">{stats?.aliasedTools || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
