# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Tool schema validation and auto-fix functionality**
  - New global configuration option `fixInvalidToolSchemas` (default: `false`)
  - Strict mode (default): Tools with invalid schemas are rejected and skipped
  - Fix mode (optional): Invalid tool schemas are automatically normalized with proper structure
  - Enhanced error handling for malformed tool schemas from MCP servers

## [1.4.0] - 2025-06-15

### Added
- New configuration hot reload system with merged config from multiple sources
- **Server retry mechanism with automatic reconnection**
  - Automatic retry with exponential backoff for failed server connections
  - Force retry API endpoints: `POST /mcp/servers/:serverId/retry` and `POST /mcp/servers/retry-all`
  - New MCP tools: `retry_server`, `retry_all_servers`, `get_server_status`
  - Detailed server status tracking including retry count, error messages, and next retry time
  - Tool calls automatically trigger retry attempts regardless of previous retry limits

### Changed
- Internationalized codebase by converting all comments to English
- Renamed "Direct Registration" feature to "Tool Aliasing" for better clarity (`directTools` → `toolAliases`)
- Renamed "Registration Patterns" feature to "Auto Tool Discovery" for better clarity (`registrationPatterns` → `toolDiscoveryRules`)
- Improved backward compatibility with legacy configuration field names
- **Enhanced `/mcp/servers` endpoint to include detailed status information**
- **Updated `list_servers` MCP tool to provide comprehensive server status data**

### Fixed
- Server connection reliability through robust retry logic
- Error handling and status reporting for MCP server connections

## [1.3.0] - 2025-06-15

### Added
- Implemented tool registration patterns feature (`registrationPatterns` configuration)
- Added wildcard pattern matching (supporting `*` and `?` symbols)
- Enhanced automatic tool registration logging
- Added sample configuration files for registration patterns

### Fixed
- Fixed MCP servers to correctly publish tools from the tool registry
- Resolved tool sharing issues between HTTP/STDIO transports
- Improved error handling during tool invocation

### Changed
- Integrated `MCPHttpServer` tool handling with the tool registry
- Updated `MCPMetaServer` to optimize tool registry usage
- Updated documentation to explain the usage of registration patterns

## [1.2.1] - 2025-06-14

### Added
- Add environment variable expansion in configuration files using ${VAR} syntax
- Add support for default values in environment variables with ${VAR:-default} syntax
- Add comprehensive README documentation for environment variable usage

### Removed
- **Breaking**: Remove deprecated `/mcp/tools/call` endpoint with namespaced tool format
- Remove all references to old namespaced tool call method
- Remove legacy tool schema definitions from API surface

### Changed
- Refactor `MCPMetaServer` to `BridgeToolRegistry` with pure in-process implementation
- Remove MCP server instance creation from BridgeToolRegistry
- Update implementation to call registry methods directly instead of via MCP protocol
- Update internal references from `mcp-bridge-meta` to `bridge-tool-registry`
- Update documentation to reflect current API design and architecture
- Standardize on explicit `serverId` and `toolName` parameters throughout codebase
- Ensure tool schema definitions match actual implementation

## [1.2.0] - 2025-06-15

### Added
- Add direct tool registration capability with optional tool renaming
- Add ability to call registered tools directly by their registered name
- Add tool management features:
  - `register_direct_tool`: Register a tool from any server for direct access
  - `unregister_direct_tool`: Remove a registered tool
  - `list_registered_tools`: List all directly registered tools
- Add persistent tool registry for improved client access 

### Changed
- Update API design for consistency and explicit parameter usage
- Use explicit `serverId` and `toolName` parameters for all tool operations
- Standardize on `call_server_tool` for server tool invocation
- Enhance direct tool registration with explicit parameters

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
