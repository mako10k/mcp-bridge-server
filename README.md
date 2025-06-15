# MCP Bridge Server

[![GitHub release](https://img.shields.io/github/release/mako10k/mcp-bridge-server.svg)](https://github.com/mako10k/mcp-bridge-server/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/mako10k/mcp-bridge.svg)](https://hub.docker.com/r/mako10k/mcp-bridge)
[![Docker Image Size](https://img.shields.io/docker/image-size/mako10k/mcp-bridge/latest.svg)](https://hub.docker.com/r/mako10k/mcp-bridge)
[![GitHub Actions](https://github.com/mako10k/mcp-bridge-server/workflows/CI/badge.svg)](https://github.com/mako10k/mcp-bridge-server/actions)

A TypeScript-based HTTP gateway for multiple STDIO-based MCP (Model Context Protocol) servers. This project solves VS Code's STDIO MCP server execution bugs by providing a unified HTTP API.

## Features

- **HTTP Gateway**: Provides RESTful API endpoints for MCP server interactions
- **Multi-Transport Support**: Supports STDIO, SSE, and HTTP transports for MCP servers
- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Dynamic Configuration**: JSON-based server configuration with environment variable expansion
- **Tool Name Conflict Resolution**: Automatic detection and namespace-based resolution
- **Auto Tool Discovery**: Automatically discover and register tools matching wildcard patterns
- **Internal Tool Registry**: Manages tools directly within the bridge for efficient access
- **Tool Aliasing**: Create aliases for tools from any server for direct access
- **Robust Error Handling**: Comprehensive error handling for all transport types
- **Comprehensive Logging**: Detailed logging for debugging MCP connections
- **Type Safety**: Full TypeScript implementation with strict type checking

## Quick Start

### Docker (Recommended)

```bash
# Run with Docker
docker run -d -p 3000:3000 mako10k/mcp-bridge:latest

# Or with docker-compose
curl -o docker-compose.yml https://raw.githubusercontent.com/mako10k/mcp-bridge-server/main/docker-compose.yml
docker-compose up -d
```

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd mcp-bridge

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Development mode with auto-reload
npm run dev
```

## Configuration

Create a `mcp-config.json` file in the project root:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "enabled": true,
      "timeout": 30000,
      "restartOnFailure": true,
      "maxRestarts": 3
    },
    {
      "name": "brave-search",
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      },
      "enabled": true,
      "timeout": 30000,
      "restartOnFailure": true,
      "maxRestarts": 3
    }
  ],
  "global": {
    "logLevel": "info",
    "maxConcurrentConnections": 10,
    "requestTimeout": 30000
  }
}
```

## API Endpoints

### Health Check
```http
GET /health
```

### Server Management
```http
# List available servers
GET /mcp/servers
```

### Tool Management
```http
# List tools from specific server
GET /mcp/servers/:serverId/tools

# List all tools from all servers (with namespace info)
GET /mcp/tools

# Get tool name conflicts
GET /mcp/conflicts

# Call tool on specific server
POST /mcp/servers/:serverId/tools/call
Content-Type: application/json

{
  "name": "tool-name",
  "arguments": {
    "param1": "value1"
  }
}

# Note: The following endpoint has been removed since v1.2.1
# Use the '/mcp/servers/:serverId/tools/call' endpoint above instead

# Or use directly registered tools:
POST /mcp/meta/tools/call
Content-Type: application/json

{
  "name": "call_server_tool",
  "arguments": {
    "serverId": "serverId",
    "toolName": "tool-name",
    "arguments": {
      "param1": "value1"
    }
  }
}
```

### Resource Management
```http
# List resources from specific server
GET /mcp/servers/:serverId/resources

# Read resource from specific server
GET /mcp/servers/:serverId/resources/:resourceUri
```

### MCP Protocol Endpoint
```http
# MCP protocol messages via HTTP
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

## Architecture

- **Express.js**: HTTP server framework
- **@modelcontextprotocol/sdk**: Official MCP SDK for client connections
- **Zod**: Schema validation for configuration and API requests
- **TypeScript**: Type safety and modern JavaScript features

## Error Handling

The server implements comprehensive error handling:
- HTTP errors with appropriate status codes
- MCP protocol error translation
- Connection failure recovery
- Request timeout handling

## Logging

Logs include:
- Server startup and shutdown events
- MCP server connection status
- Request/response information
- Error details with stack traces

## Tool Registry

The MCP Bridge Server includes an internal Tool Registry that manages tools and provides a unified interface for all tool operations.

### Tool Registry Features

The Bridge Tool Registry provides the following features:

- **Direct Tool Registration**: Register tools from any server for direct access through the bridge
- **Tool Namespacing**: Assign unique names to tools to avoid conflicts
- **Tool Lookup**: Find tools across all connected servers
- **Tool Management**: Register, unregister, and list tools

### Available Registry Tools

The Bridge Tool Registry provides the following management tools:

- **`list_servers`**: List all connected MCP servers
- **`list_all_tools`**: List all tools from all servers with namespace info
- **`list_conflicts`**: Detect tool name conflicts between servers
- **`list_server_tools`**: List tools from a specific server
- **`call_server_tool`**: Call a tool on a specific MCP server
- **`register_direct_tool`**: Register a tool for direct access
- **`unregister_direct_tool`**: Remove a registered tool
- **`list_registered_tools`**: List all directly registered tools
- **`list_server_resources`**: List resources from a specific server
- **`read_server_resource`**: Read a resource from a specific server

### Example: Using the Tool Registry

```bash
# List available servers
curl http://localhost:3000/mcp/servers

# Register a tool for direct access
curl -X POST http://localhost:3000/mcp/servers/bridge-tool-registry/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "register_direct_tool", 
    "arguments": {
      "serverId": "filesystem",
      "toolName": "read_file",
      "newName": "fs_read"
    }
  }'

# List all registered tools
curl -X POST http://localhost:3000/mcp/servers/bridge-tool-registry/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "list_registered_tools", "arguments": {}}'
```

This provides a flexible and unified way to manage tools across multiple MCP servers.

## Tool Name Conflict Resolution

When multiple MCP servers provide tools with the same name, the MCP Bridge Server provides several solutions:

### 1. Namespace-based Tool Names

All tools are automatically assigned namespaced names in the format `serverId:toolName`:

```bash
# Note: Since v1.2.1, explicit serverId and toolName are required
curl -X POST http://localhost:3000/mcp/servers/filesystem/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "read_file", "arguments": {"path": "/tmp/test.txt"}}'
```

### 2. Conflict Detection

The server automatically detects and reports tool name conflicts:

```bash
# Get all tool name conflicts
curl http://localhost:3000/mcp/conflicts
```

Response example:
```json
{
  "conflicts": [
    {
      "toolName": "read_file",
      "servers": ["filesystem", "filesystem2"]
    }
  ]
}
```

### 3. Server-scoped API

The original server-scoped API ensures no ambiguity:

```bash
# Call tool on specific server
curl -X POST http://localhost:3000/mcp/servers/filesystem/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "read_file", "arguments": {"path": "/tmp/test.txt"}}'
```

### 4. Unified Tool Listing

Get all tools from all servers with namespace information:

```bash
# Get all tools with namespace information
curl http://localhost:3000/mcp/tools
```

Each tool includes:
- `name`: Original tool name
- `namespacedName`: Namespaced tool name (serverId:toolName)
- `serverId`: Source server ID
- `description`: Tool description
- `inputSchema`: Tool input schema

## Transport Support

The MCP Bridge Server supports multiple transport protocols for connecting to MCP servers:

### 1. STDIO Transport (Default)
For local process-based MCP servers:

```json
{
  "name": "filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "env": {
    "CUSTOM_VAR": "value"
  },
  "cwd": "/custom/working/directory"
}
```

### 2. SSE Transport (Server-Sent Events)
For HTTP-based MCP servers using Server-Sent Events:

```json
{
  "name": "remote-sse-server",
  "transport": "sse",
  "url": "http://localhost:3001/sse",
  "headers": {
    "Authorization": "Bearer your-token",
    "Custom-Header": "value"
  }
}
```

### 3. HTTP Transport (StreamableHTTP)
For HTTP-based MCP servers using StreamableHTTP:

```json
{
  "name": "remote-http-server",
  "transport": "http", 
  "url": "http://localhost:3002/mcp",
  "headers": {
    "Authorization": "Bearer your-token",
    "Content-Type": "application/json"
  }
}
```

### Transport Configuration Options

| Option | STDIO | SSE | HTTP | Description |
|--------|-------|-----|------|-------------|
| `command` | ✅ Required | ❌ | ❌ | Command to execute |
| `args` | ✅ Optional | ❌ | ❌ | Command arguments |
| `env` | ✅ Optional | ❌ | ❌ | Environment variables |
| `cwd` | ✅ Optional | ❌ | ❌ | Working directory |
| `url` | ❌ | ✅ Required | ✅ Required | Server URL |
| `headers` | ❌ | ✅ Optional | ✅ Optional | HTTP headers |

### Mixed Transport Example

```json
{
  "servers": [
    {
      "name": "local-filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    {
      "name": "remote-api-server",
      "transport": "sse",
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer sk-...",
        "X-Client-Version": "1.0.0"
      }
    },
    {
      "name": "cloud-mcp-service",
      "transport": "http",
      "url": "https://mcp-service.cloud.com/api",
      "headers": {
        "API-Key": "your-api-key"
      }
    }
  ]
}
```

## Usage Examples

### Testing Multiple Transports

1. **Start the test SSE server** (in a separate terminal):
```bash
npm run test-sse-server
```

2. **Update configuration** to include the SSE server:
```bash
cp examples/mcp-config-multi-transport.json mcp-config.json
```

3. **Start the bridge server**:
```bash
npm start
```

4. **Test the multi-transport setup**:
```bash
# List all connected servers
curl http://localhost:3000/mcp/servers

# Get tools from STDIO server
curl http://localhost:3000/mcp/servers/filesystem-stdio/tools

# Get tools from SSE server  
curl http://localhost:3000/mcp/servers/test-sse-server/tools

# Call tool on SSE server with explicit serverId and toolName
curl -X POST http://localhost:3000/mcp/servers/test-sse-server/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "echo", "arguments": {"text": "Hello from SSE!"}}'
```

## Docker Deployment

MCP Bridge Server includes comprehensive Docker support for easy deployment and scaling.

### Quick Start with Docker

1. **Using Docker Compose (Recommended):**
   ```bash
   # Production deployment
   docker-compose up -d
   
   # Development with live reload
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Using npm scripts:**
   ```bash
   # Build and run production
   npm run docker:run
   
   # Build and run development
   npm run docker:run:dev
   
   # Stop services
   npm run docker:stop
   ```

3. **Using Docker directly:**
   ```bash
   # Build image
   docker build -t mcp-bridge-server .
   
   # Run container
   docker run -d \
     --name mcp-bridge \
     -p 3000:3000 \
     -v $(pwd)/mcp-config.json:/app/mcp-config.json:ro \
     -v $(pwd)/logs:/app/logs \
     mcp-bridge-server
   ```

### Configuration for Docker

Create a Docker-specific configuration:
```bash
cp docker/mcp-config.docker.json mcp-config.json
# Edit mcp-config.json with your settings
```

### Advanced Docker Operations

The included `docker/build.sh` script provides advanced operations:

```bash
# Build with specific tag
./docker/build.sh --action build --tag v1.0.0

# Build and push to registry
./docker/build.sh --action build --tag v1.0.0 --push

# Clean up Docker resources
./docker/build.sh --action clean
```

### Multi-Service Architecture

Deploy MCP servers as separate containers:
```yaml
# docker-compose.yml
services:
  mcp-bridge:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - mcp-filesystem
      - mcp-search
      
  mcp-filesystem:
    image: your-filesystem-server:latest
    
  mcp-search:
    image: your-search-server:latest
```

### Health Monitoring

```bash
# Check container health
docker ps

# View health check endpoint
curl http://localhost:3000/health

# Monitor logs
docker-compose logs -f
```

See [docker/README.md](docker/README.md) for comprehensive Docker documentation.

## Tool Registration Patterns

MCP Bridge Server supports automatic tool registration using wildcard patterns. This feature allows you to:

1. Automatically register tools from specific servers
2. Register all tools that match a naming pattern
3. Exclude certain tools from registration

### Configuration Example

Add `registrationPatterns` to your `mcp-config.json`:

```json
{
  "servers": [...],
  "registrationPatterns": [
    {
      "serverPattern": "filesystem",     // Server name pattern
      "toolPattern": "*",               // Register all tools
      "exclude": false                  // Register (false=register, true=exclude)
    },
    {
      "serverPattern": "*",             // From all servers
      "toolPattern": "read_*",          // Register tools starting with read_
      "exclude": false
    },
    {
      "serverPattern": "*",             // From all servers
      "toolPattern": "internal_*",      // Tools starting with internal_
      "exclude": true                   // Don't register (exclude)
    }
  ],
  "directTools": [
    {
      "serverId": "brave-search",       // Individually register specific tools
      "toolName": "search",
      "newName": "brave_search"         // Register with an alias
    }
  ]
}
```

### Pattern Matching Rules

- Wildcard patterns support:
  - `*`: Matches any sequence of characters
  - `?`: Matches any single character
- Patterns are evaluated in order, with later exclusion patterns taking precedence
- If no pattern matches a tool, it will not be registered

### Usage Example

```bash
# Start with registration patterns config
npm start -- ./examples/mcp-config-with-patterns.json

# Check which tools were automatically registered
curl http://localhost:3000/mcp/tools/registered
```

## Environment Variable Expansion

The MCP Bridge Server supports environment variable expansion in the configuration file. Any string value in the configuration file can use `${VARIABLE_NAME}` syntax to reference environment variables.

### Example:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${HOME}/data"],
      "env": {
        "DEBUG": "${DEBUG_LEVEL:-false}",
        "MAX_MEMORY": "${MAX_MEMORY:-1024}",
        "USER_PATH": "${HOME}/user"
      }
    },
    {
      "name": "http-server",
      "transport": "http",
      "url": "${API_URL:-http://localhost:3001}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  ]
}
```

### Usage Notes:

- If an environment variable is not defined, the original string (`${VAR}`) remains unchanged
- Environment variable expansion works in all string values throughout the configuration
- This is especially useful for:
  - Paths and directories
  - API keys and tokens
  - URLs and endpoints
  - Environment-specific settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License
