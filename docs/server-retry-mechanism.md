# MCP Server Retry Mechanism Specification

## Purpose
Enhance MCP server connection stability and provide automatic recovery functionality from temporary failures.

## Functional Requirements

### 1. Automatic Retry Function
- Automatic retry on server connection failure
- Configurable retry interval and maximum retry count
- Status tracking and management during retry

### 2. Conditional Retry
- When tool calls are attempted, retry again even if maximum retry count has been reached
- User can force retry at any time

### 3. Server Status Management
- Track current status of each server (connected, disconnected, retrying, failed)
- Return status information in server list endpoint
- Provide detailed information such as retry count and last connection attempt time

### 4. Force Retry Function
- API endpoint to forcibly retry servers that have stopped retrying
- Function to retry only specific servers by specifying server ID

## Technical Specification

### Server Status Definition
```typescript
enum MCPServerStatus {
  CONNECTED = 'connected',      // Connected
  DISCONNECTED = 'disconnected',// Disconnected state
  CONNECTING = 'connecting',    // Connection attempt in progress
  RETRYING = 'retrying',        // Retrying
  FAILED = 'failed'             // Failed after reaching maximum retry count
}
```

### Server Status Tracking
```typescript
interface MCPServerStatusInfo {
  status: MCPServerStatus;      // Current status
  retryCount: number;           // Current retry count
  maxRetries: number;           // Configured maximum retry count
  lastRetryTime: Date | null;   // Last retry time
  errorMessage: string | null;  // Latest error message
}
```

### API Endpoints
1. **Server List (Extended)**:
   - `GET /mcp/servers` - Returns each server's current status information

2. **Force Retry**:
   - `POST /mcp/servers/:serverId/retry` - Force retry for specified server
   - `POST /mcp/servers/retry-all` - Force retry for all failed servers

3. **MCP Tool Endpoints**:
   - `retry_server` - Tool to force retry execution
   - `get_server_status` - Tool to get detailed server status

## Implementation Plan
1. Define MCPServerStatus enum and MCPServerStatusInfo interface
2. Add status tracking functionality to MCPBridgeManager
3. Implement automatic retry logic
4. Implement retry logic for tool calls
5. Implement extended server list endpoint
6. Implement force retry API endpoints
7. Implement corresponding tools
8. Testing and debugging

## Implementation Status

### HTTP Endpoints

#### Server Management
1. **GET `/mcp/servers`** - Get server list and detailed status
   - ✅ Implemented - Returns detailed information including server connection state, retry information, and error messages

2. **POST `/mcp/servers/:serverId/retry`** - Force retry for specific server
   - ✅ Implemented - Forces retry even for servers that have reached maximum retry count

3. **POST `/mcp/servers/retry-all`** - Force retry for all failed servers
   - ✅ Implemented - Execute retry for all servers in failed state

4. **GET `/mcp/servers/:serverId/status`** - Detailed status for specific server
   - ⚠️ Temporarily disabled due to TypeScript type issues - Can be substituted with `/mcp/servers` endpoint

### MCP Tools
1. **retry_server** - Force retry tool for specific server
   - ✅ Implemented - Available directly from MCP clients

2. **retry_all_servers** - Force retry tool for all failed servers
   - ✅ Implemented - Batch retry for all servers

3. **get_server_status** - Server status retrieval tool
   - ✅ Implemented - Get detailed status information for specific server

4. **list_servers** - Server list tool (extended)
   - ✅ Implemented - Extended to include detailed status information in addition to conventional functionality

## Test Results

### Automatic Retry Function
- ✅ Automatic retry on server connection failure
- ✅ Retry interval adjustment with exponential backoff (1s → 2s → 4s → ...)
- ✅ Setting and adherence to maximum retry count
- ✅ Accurate tracking of retry status
- ✅ Recording of error messages

### Force Retry Function
- ✅ Specific server retry from HTTP endpoints
- ✅ All server retry from HTTP endpoints
- ✅ Retry execution from MCP tools
- ✅ Retry count reset

### Retry on Tool Calls
- ✅ Server connection verification before tool calls
- ✅ Automatic retry trigger on connection failure
- ✅ Force retry regardless of maximum retry count

### Status Reporting
- ✅ Status information display in server list
- ✅ Tracking of retry count, last retry time, next retry time
- ✅ Storage and display of error messages
