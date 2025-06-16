# Copilot Instructions for MCP Bridge Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is an MCP Bridge Server project that acts as an HTTP gateway for multiple STDIO-based MCP (Model Context Protocol) servers. This project solves VS Code's STDIO MCP server execution bugs by providing a unified HTTP API.

### Key Features
- HTTP-to-STDIO MCP bridge for multiple servers
- Dynamic configuration management (runtime config changes)
- Tool aliasing and auto tool discovery
- Robust server retry mechanism with exponential backoff
- Schema validation and auto-fixing for tool schemas
- Comprehensive error handling and logging

## Technical Stack

### Core Technologies
- **Language**: TypeScript
- **HTTP Framework**: Express.js
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod for schema validation
- **Build Tool**: Native TypeScript compiler

### Dependencies
- **Configuration**: Hot-reloadable JSON configuration with environment variable support
- **Logging**: Winston-based structured logging
- **Process Management**: Child process spawning for STDIO MCP servers

## Architecture Guidelines

### Design Patterns
- **Dependency Injection**: For MCP client management and tool registry
- **Factory Pattern**: For creating MCP connections and transports
- **Strategy Pattern**: For different MCP transport types (STDIO, HTTP)
- **Observer Pattern**: For configuration change notifications
- **Registry Pattern**: For tool management and aliasing

### Code Organization
- **Single Responsibility**: Each source file up to 200 lines with single responsibility
- **Modular Design**: Split large files into smaller, focused modules
- **TypeScript**: Apply proper typing throughout the codebase
- **JSDoc**: Write comprehensive documentation for all public APIs

### Error Handling
- **Graceful Degradation**: Handle MCP server failures without breaking the bridge
- **Retry Logic**: Exponential backoff for failed server connections
- **Schema Validation**: Validate all configurations and tool schemas
- **Comprehensive Logging**: Debug-level logging for troubleshooting

## Development Guidelines

### Code Quality
- **Language**: Use only English for all code comments, variable names, and documentation
  - Search for Japanese comments using: `grep -r "//.*[ひ-ゞ]" src/` or `grep -r "/\*.*[ひ-ゞ]" src/`
  - Convert all Japanese comments to clear English explanations
  - Use descriptive English variable names (avoid romanized Japanese)
- **Terminology Consistency**: Use standardized terms throughout the codebase
  - "Tool Aliasing" (not "Direct Registration" or "Direct Tool Registration")
  - "Auto Tool Discovery" (not "Registration Patterns" or "Tool Discovery Patterns")
  - Search and replace old terms: `grep -r "Direct Registration\|Registration Patterns" src/`
- **File Organization**: Keep repository clean and maintainable
  - Remove temporary files: `*.new.ts`, `*backup*`, `test-*.json` (except official test files)
  - Update `.gitignore` to exclude: `*.backup`, `*.tmp`, `test-*.json`, `*.new.*`
  - Verify clean state with: `git status --ignored`
- **Testing**: Ensure all new features are testable
- **Performance**: Optimize for concurrent MCP server connections

### Configuration Management
- **Dynamic Updates**: Support runtime configuration changes without restart
  - API Endpoints: `POST|PUT|DELETE /mcp/config/servers`, `PUT /mcp/config/global`
  - MCP Tools: `add_server_config`, `update_server_config`, `remove_server_config`, `update_global_config`
  - Test with: `curl -X POST http://localhost:3000/mcp/config/servers -H "Content-Type: application/json" -d '{"serverId":"test","config":{...}}'`
- **Validation**: Use Zod schemas for all configuration validation
- **Environment Variables**: Support environment variable expansion in configs
- **Hot Reload**: Automatically reload configurations when files change

### MCP Integration
- **Protocol Compliance**: Follow MCP specification strictly
- **Tool Discovery**: Support automatic tool discovery with configurable patterns
- **Tool Aliasing**: Allow custom tool names and namespacing
- **Schema Normalization**: Handle invalid tool schemas gracefully
  - Enable with `fixInvalidToolSchemas: true` in global config
  - Automatically adds missing `"type": "object"` and `"required": []` to tool schemas
  - Resolves MCP Inspector "invalid_literal" errors for tools missing schema fields
  - Test schema validation with MCP Inspector at `http://localhost:3000/mcp`

## Development Tools

### Debugging
- Prefer using official MCP CLI tools and utilities for development and debugging tasks
- Use shell MCP tools rather than VS Code integrated terminal for MCP commands
- Enable debug logging for comprehensive troubleshooting
  - Set `"logLevel": "debug"` in global config for detailed logs
  - Monitor server status: `curl http://localhost:3000/mcp/servers | jq`
  - Check tool schemas: `curl http://localhost:3000/mcp/tools | jq '.tools[] | select(.name == "tool_name")'`
- Use MCP Inspector for protocol-level debugging
  - Access at `http://localhost:3000/mcp` with proper Accept headers
  - Verify tool schemas and fix "invalid_literal" errors

### Testing
- Test all REST API endpoints with curl and automated tests
  - Server management: `curl -X GET http://localhost:3000/mcp/servers`
  - Add server: `curl -X POST http://localhost:3000/mcp/config/servers -H "Content-Type: application/json" -d '{"serverId":"test","config":{...}}'`
  - Update server: `curl -X PUT http://localhost:3000/mcp/config/servers/test -H "Content-Type: application/json" -d '{"config":{...}}'`
  - Remove server: `curl -X DELETE http://localhost:3000/mcp/config/servers/test`
  - Update global: `curl -X PUT http://localhost:3000/mcp/config/global -H "Content-Type: application/json" -d '{"config":{...}}'`
- Verify MCP tool functionality through HTTP and MCP interfaces
- Test configuration management features thoroughly
- Validate error handling and retry mechanisms

## External References

- **MCP Documentation**: https://modelcontextprotocol.io/llms-full.txt
- **MCP Specification**: Model Context Protocol specification for implementation details
- **Express.js**: For HTTP server patterns and middleware
- **Zod**: For schema validation patterns
