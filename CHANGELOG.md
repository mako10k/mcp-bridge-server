# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-06-14

### Fixed
- Fix HTTP and SSE transport constructor calls to properly accept URL as first parameter
- Fix issue `TypeError: Failed to parse URL from [object Object]` in HTTP and SSE connections
- Add improved URL validation and more detailed error reporting
- Add enhanced debugging logs for transport creation
- Add test SSE server configuration (disabled) for easier testing

### Changed
- Update constructor parameter order for transports to match SDK spec
- Move headers to `requestInit.headers` structure for better compliance

## [1.1.1] - 2025-06-14

### Added
- Add Docker publishing automation with GitHub Actions
- Add multi-architecture builds (amd64, arm64) for Docker images
- Add Docker publishing documentation in DOCKER_PUBLISH.md

## [1.1.0] - 2025-06-14

### Added
- Add comprehensive Docker support with multi-stage builds
- Add production and development Docker configurations
- Add Docker Compose configurations for easy deployment
- Add container management script (docker/build.sh)
- Add Docker documentation and usage examples
- Add health check for container monitoring

## [1.0.0] - 2025-06-14

### Added
- Initial release of MCP Bridge Server
- HTTP gateway for MCP (Model Context Protocol) servers
- Support for multiple transport protocols:
  - STDIO transport for local process-based MCP servers
  - SSE (Server-Sent Events) transport for HTTP-based MCP servers
  - HTTP (StreamableHTTP) transport for HTTP-based MCP servers
- Multi-server support with simultaneous connections
- Tool name conflict detection and resolution:
  - Automatic namespace assignment (serverId:toolName)
  - Conflict detection API endpoint
  - Server-scoped and unified tool APIs
- MCP Meta Server functionality:
  - Acts as an MCP server providing meta-tools for bridge management
  - 8 meta-tools for server and tool management
  - Dual operation modes (HTTP server + pure MCP server)
- RESTful API endpoints:
  - Server management endpoints
  - Tool listing and execution endpoints  
  - Resource management endpoints
  - MCP protocol endpoint for HTTP-based MCP communication
- Dynamic JSON-based configuration system with validation
- Comprehensive error handling for all transport types
- Detailed logging with transport-specific information
- TypeScript implementation with strict type checking
- Example configurations and test servers

### Features
- HTTP Gateway with CORS support
- Multi-transport MCP server connections
- Tool name conflict resolution with namespacing
- Meta MCP server with management tools
- Dynamic configuration with hot-reload support
- Robust error handling and logging
- Type-safe implementation

### API Endpoints
- `GET /health` - Health check
- `GET /mcp/servers` - List connected servers
- `GET /mcp/tools` - List all tools with namespace info
- `GET /mcp/conflicts` - Detect tool name conflicts
- `POST /mcp/tools/call` - Call tools using namespaced names
- `GET /mcp/servers/:serverId/tools` - List server-specific tools
- `POST /mcp/servers/:serverId/tools/call` - Call server-specific tools
- `GET /mcp/servers/:serverId/resources` - List server resources
- `GET /mcp/servers/:serverId/resources/:resourceUri` - Read resources
- `POST /mcp` - MCP protocol endpoint

### Configuration
- Support for STDIO, SSE, and HTTP transport configurations
- Flexible server configuration with transport-specific options
- Environment variable support for STDIO servers
- Header customization for HTTP/SSE servers
- Global configuration options

### Documentation
- Comprehensive README with usage examples
- Transport configuration guide
- API documentation
- Contributing guidelines
- Example configurations and test setups
