import { MCPConnection } from './mcp-bridge-types';
import { logger } from '../utils/logger.js';

export class MCPResourceManager {
  constructor(private getConnections: () => Map<string, MCPConnection>) {}

  async listResources(serverId: string): Promise<any[]> {
    const connection = this.getConnections().get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }
    try {
      const response = await connection.client.listResources();
      return response.resources;
    } catch (error) {
      logger.error(`Failed to list resources for server ${serverId}:`, error);
      throw error;
    }
  }

  async readResource(serverId: string, resourceUri: string): Promise<any> {
    const connection = this.getConnections().get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }
    try {
      const response = await connection.client.readResource({ uri: resourceUri });
      return response;
    } catch (error) {
      logger.error(`Failed to read resource ${resourceUri} from server ${serverId}:`, error);
      throw error;
    }
  }
}
