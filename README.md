# MCP Bridge Server

A TypeScript-based HTTP gateway for multiple STDIO-based MCP (Model Context Protocol) servers. This project solves VS Code's STDIO MCP server execution bugs by providing a unified HTTP API.

## Features

- **HTTP Gateway**: Provides RESTful API endpoints for MCP server interactions
- **Multi-Transport Support**: Supports STDIO, SSE, and HTTP transports for MCP servers
- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Dynamic Configuration**: JSON-based server configuration with hot-reload capabilities
- **Tool Name Conflict Resolution**: Automatic detection and namespace-based resolution
- **MCP Meta Server**: Acts as an MCP server providing meta-tools for bridge management
- **Robust Error Handling**: Comprehensive error handling for all transport types
- **Comprehensive Logging**: Detailed logging for debugging MCP connections
- **Type Safety**: Full TypeScript implementation with strict type checking

## Quick Start

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

# Call tool using namespaced name
POST /mcp/tools/call
Content-Type: application/json

{
  "name": "serverId:tool-name",
  "arguments": {
    "param1": "value1"
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

## MCP Meta Server

The MCP Bridge Server can also operate as an MCP server itself, providing meta-tools for managing the bridge and connected servers.

### Running as MCP Server

```bash
# Start as pure MCP server (stdio)
npm run mcp-server

# Or use the HTTP endpoint for MCP protocol messages
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}'
```

### Meta Tools Available

The MCP Bridge provides the following meta-tools:

- **`list_servers`**: List all connected MCP servers
- **`list_all_tools`**: List all tools from all servers with namespace info
- **`list_conflicts`**: Detect tool name conflicts between servers
- **`list_server_tools`**: List tools from a specific server
- **`call_tool`**: Call a tool using namespaced name (serverId:toolName)
- **`call_server_tool`**: Call a tool on a specific server
- **`list_server_resources`**: List resources from a specific server
- **`read_server_resource`**: Read a resource from a specific server

### Example: Using as MCP Server

```json
{
  "mcpServers": {
    "mcp-bridge-meta": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/mcp-bridge"
    }
  }
}
```

This allows you to manage multiple MCP servers through a single meta-server interface.

## Tool Name Conflict Resolution

When multiple MCP servers provide tools with the same name, the MCP Bridge Server provides several solutions:

### 1. Namespace-based Tool Names

All tools are automatically assigned namespaced names in the format `serverId:toolName`:

```bash
# Example: filesystem server's read_file tool becomes "filesystem:read_file"
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "filesystem:read_file", "arguments": {"path": "/tmp/test.txt"}}'
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

# Call tool on SSE server via namespaced name
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "test-sse-server:echo", "arguments": {"text": "Hello from SSE!"}}'
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

## Docker Deployment

### Quick Docker Setup

```bash
# Build and run using docker-compose
docker-compose up -d

# Or using our build script
./docker/build.sh --action run

# Check service health
curl http://localhost:3000/health

# Stop the service
./docker/build.sh --action stop
```

### Docker Commands

```bash
# Production deployment
docker-compose up -d

# Development mode with debugging
docker-compose -f docker-compose.dev.yml up -d

# Build only
docker build -t mcp-bridge .

# Run with custom configuration
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/my-mcp-config.json:/app/mcp-config.json:ro \
  mcp-bridge:latest
```

### Docker Environment Variables

- `NODE_ENV`: Set to `production` or `development`
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)
- `CONFIG_PATH`: Path to configuration file (default: `/app/mcp-config.json`)
- `PORT`: Server port (default: `3000`)

### Production Deployment

For production deployments with remote MCP servers:

```json
{
  "servers": [
    {
      "name": "local-filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
    },
    {
      "name": "ai-service",
      "transport": "sse",
      "url": "https://ai-mcp-service.example.com/sse",
      "headers": {
        "Authorization": "Bearer ${AI_SERVICE_TOKEN}",
        "X-Environment": "production"
      }
    },
    {
      "name": "database-service", 
      "transport": "http",
      "url": "https://db-mcp.internal.company.com/api",
      "headers": {
        "X-API-Key": "${DB_API_KEY}",
        "X-Service": "mcp-bridge"
      }
    }
  ]
}
```

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License
