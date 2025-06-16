import api from './api';
import type { 
  MCPServer, 
  MCPServerConfig, 
  Tool, 
  ToolAlias, 
  GlobalConfig, 
  ServerStats,
  LogEntry 
} from '../types';

export class MCPBridgeService {
  // Server Management
  async getServers(): Promise<MCPServer[]> {
    const response = await api.get('/mcp/servers');
    return response.data.servers || [];
  }

  async getServerStatus(serverId: string): Promise<MCPServer> {
    const response = await api.get(`/mcp/servers/${serverId}/status`);
    return response.data;
  }

  async addServer(serverId: string, config: MCPServerConfig): Promise<void> {
    await api.post('/mcp/config/servers', { serverId, config });
  }

  async updateServer(serverId: string, config: MCPServerConfig): Promise<void> {
    await api.put(`/mcp/config/servers/${serverId}`, { config });
  }

  async removeServer(serverId: string): Promise<void> {
    await api.delete(`/mcp/config/servers/${serverId}`);
  }

  async retryServer(serverId: string): Promise<void> {
    await api.post(`/mcp/servers/${serverId}/retry`);
  }

  async retryAllServers(): Promise<void> {
    await api.post('/mcp/servers/retry-all');
  }

  // Tool Management
  async getTools(): Promise<Tool[]> {
    const response = await api.get('/mcp/tools');
    return response.data.tools || [];
  }

  async getToolAliases(): Promise<ToolAlias[]> {
    const response = await api.get('/mcp/tools/aliases');
    return response.data.aliases || [];
  }

  async createToolAlias(alias: string, originalName: string, serverId: string): Promise<void> {
    await api.post('/mcp/tools/aliases', { alias, originalName, serverId });
  }

  async removeToolAlias(alias: string): Promise<void> {
    await api.delete(`/mcp/tools/aliases/${alias}`);
  }

  // Global Configuration
  async getGlobalConfig(): Promise<GlobalConfig> {
    const response = await api.get('/mcp/config/global');
    return response.data;
  }

  async updateGlobalConfig(config: Partial<GlobalConfig>): Promise<void> {
    await api.put('/mcp/config/global', { config });
  }

  // Dashboard Stats
  async getStats(): Promise<ServerStats> {
    const servers = await this.getServers();
    const tools = await this.getTools();
    const aliases = await this.getToolAliases();

    return {
      totalServers: servers.length,
      connectedServers: servers.filter(s => s.status.state === 'connected').length,
      failedServers: servers.filter(s => s.status.state === 'failed').length,
      totalTools: tools.length,
      aliasedTools: aliases.length,
    };
  }

  // Log Management (mock implementation for now)
  async getLogs(limit = 100): Promise<LogEntry[]> {
    // This would be implemented when log endpoint is available
    return [];
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      await api.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const mcpBridgeService = new MCPBridgeService();
