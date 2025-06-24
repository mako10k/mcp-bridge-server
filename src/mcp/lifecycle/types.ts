/**
 * Types for MCP Lifecycle Management
 */

/**
 * Represents the context of an MCP instance.
 */
export interface MCPInstanceContext {
  sessionId: string; // Unique identifier for the session
  createdAt: Date;   // Timestamp when the instance was created
}