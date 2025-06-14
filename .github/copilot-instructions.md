# Copilot Instructions for MCP Bridge Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is an MCP Bridge Server project that acts as an HTTP gateway for multiple STDIO-based MCP (Model Context Protocol) servers. This project solves VS Code's STDIO MCP server execution bugs by providing a unified HTTP API.

## Key Guidelines

1. **Architecture**: Use TypeScript with Express.js for the HTTP server
2. **MCP Integration**: Use the @modelcontextprotocol/sdk for STDIO MCP client connections
3. **Error Handling**: Implement robust error handling for both HTTP and MCP protocol errors
4. **Configuration**: Support dynamic MCP server configuration via JSON files
5. **Logging**: Include comprehensive logging for debugging MCP connections

## Technical Stack

- **Language**: TypeScript
- **HTTP Framework**: Express.js
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod for schema validation
- **Build Tool**: Native TypeScript compiler

## MCP Documentation Reference

You can find more info and examples at https://modelcontextprotocol.io/llms-full.txt

## Design Patterns

- Use dependency injection for MCP client management
- Implement middleware for request/response transformation
- Use factory patterns for creating MCP connections
- Apply proper TypeScript typing throughout
