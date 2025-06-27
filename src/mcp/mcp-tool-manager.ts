import { NamespacedTool, ToolConflict, MCPConnection } from './mcp-bridge-types';
import { logger } from '../utils/logger.js';

export class MCPToolManager {
  constructor(private getConnections: () => Map<string, MCPConnection>) {}

  async listTools(serverId: string): Promise<any[]> {
    const connection = this.getConnections().get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }
    try {
      const response = await connection.client.listTools();
      return response.tools;
    } catch (error) {
      logger.error(`Failed to list tools for server ${serverId}:`, error);
      throw error;
    }
  }

  normalizeOrValidateToolSchema(tool: any, serverId: string, fixInvalidSchemas = false): any {
    let inputSchema = tool.input_schema || tool.inputSchema;
    const isInvalid = !inputSchema || typeof inputSchema !== 'object' || !inputSchema.type || !inputSchema.properties;
    if (isInvalid) {
      if (!fixInvalidSchemas) {
        const errorMsg = `Invalid tool schema for ${tool.name} from server ${serverId}: missing required fields (type, properties, or schema is not an object)`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        logger.warn(`Auto-fixing invalid schema for tool ${tool.name} from server ${serverId}`);
        if (!inputSchema || typeof inputSchema !== 'object') {
          inputSchema = { type: 'object', properties: {}, required: [] };
        } else {
          if (!inputSchema.type) inputSchema.type = 'object';
          if (!inputSchema.properties) inputSchema.properties = {};
          if (!inputSchema.required) inputSchema.required = [];
        }
      }
    }
    return inputSchema;
  }

  async getServerTools(serverId: string, fixInvalidSchemas = false): Promise<{ name: string, description: string, inputSchema: any }[]> {
    const tools = await this.listTools(serverId);
    const validTools: { name: string, description: string, inputSchema: any }[] = [];
    for (const tool of tools) {
      try {
        const inputSchema = this.normalizeOrValidateToolSchema(tool, serverId, fixInvalidSchemas);
        validTools.push({
          name: tool.name,
          description: tool.description || '',
          inputSchema
        });
      } catch (error) {
        logger.error(`Skipping tool ${tool.name} from server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }
    return validTools;
  }

  async getAllTools(): Promise<NamespacedTool[]> {
    const allTools: NamespacedTool[] = [];
    for (const [serverId, connection] of this.getConnections().entries()) {
      if (!connection.connected) continue;
      try {
        const response = await connection.client.listTools();
        for (const tool of response.tools) {
          try {
            const inputSchema = this.normalizeOrValidateToolSchema(tool, serverId);
            allTools.push({
              name: tool.name,
              namespacedName: `${serverId}:${tool.name}`,
              serverId,
              description: tool.description,
              inputSchema
            });
          } catch (error) {
            logger.error(`Skipping tool ${tool.name} from server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            continue;
          }
        }
      } catch (error) {
        logger.error(`Failed to get tools from server ${serverId}:`, error);
      }
    }
    return allTools;
  }

  async getToolConflicts(): Promise<ToolConflict[]> {
    const allTools = await this.getAllTools();
    const toolMap = new Map<string, string[]>();
    for (const tool of allTools) {
      if (!toolMap.has(tool.name)) toolMap.set(tool.name, []);
      toolMap.get(tool.name)!.push(tool.serverId);
    }
    const conflicts: ToolConflict[] = [];
    for (const [toolName, servers] of toolMap.entries()) {
      if (servers.length > 1) {
        conflicts.push({ toolName, servers: [...new Set(servers)] });
      }
    }
    return conflicts;
  }

  async getToolByNamespace(namespacedName: string): Promise<NamespacedTool | null> {
    const allTools = await this.getAllTools();
    return allTools.find(tool => tool.namespacedName === namespacedName) || null;
  }
}
