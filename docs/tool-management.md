# Tool Management in MCP Bridge - Implementation Complete

MCP Bridge provides comprehensive tool management through **Tool Aliasing** and **Auto Tool Discovery** features.

## ✅ Tool Aliasing (formerly "Direct Registration")

Tool Aliasing allows you to create aliases for specific tools from any connected MCP server, making them directly accessible without namespace prefixing.

### Implementation Status
- ✅ Configuration-based tool aliases
- ✅ Runtime alias creation/removal via API
- ✅ Admin UI for visual alias management
- ✅ Search and filtering capabilities
- ✅ Conflict detection and resolution

### Configuration

Tool aliases can be defined in the configuration file:

```json
{
  "servers": [...],
  "toolAliases": [
    {
      "serverId": "google-search",
      "toolName": "web_search",
      "newName": "search"
    },
    {
      "serverId": "filesystem",
      "toolName": "read_file"
    }
  ]
}
```

### Runtime Management

```bash
# Create alias via API
curl -X POST http://localhost:3002/mcp/meta/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_tool_alias",
    "arguments": {
      "serverId": "git",
      "toolName": "git_status",
      "aliasName": "status"
    }
  }'

# List all aliases
curl http://localhost:3002/mcp/tool-aliases

# Remove alias
curl -X POST http://localhost:3002/mcp/meta/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "remove_tool_alias",
    "arguments": {
      "aliasName": "status"
    }
  }'
```

When a tool is aliased, it can be accessed directly via the bridge:

```
// Without aliasing:
POST /mcp/call/google-search/web_search
    
// With aliasing:
POST /mcp/call/search
```

### API Tools

- `create_tool_alias`: Create an alias for a server tool
- `remove_tool_alias`: Remove a tool alias
- `list_aliased_tools`: List all tool aliases

## Auto Tool Discovery (formerly "Registration Patterns")

Auto Tool Discovery provides a way to automatically discover and register multiple tools based on wildcard patterns. This feature is especially useful for quickly exposing many tools without manually configuring each one.

### Configuration

```json
{
  "servers": [...],
  "toolDiscoveryRules": [
    {
      "serverPattern": "*",         // Match all servers
      "toolPattern": "get_*",       // Only tools starting with "get_"
      "exclude": false              // Include matching tools (default)
    },
    {
      "serverPattern": "internal-*",
      "toolPattern": "*_private",
      "exclude": true               // Exclude matching tools
    }
  ]
}
```

### Pattern Matching

- `*`: Matches any number of characters
- `?`: Matches exactly one character
- Rules are evaluated in order, with later exclude rules taking precedence

### Behavior

1. When the MCP Bridge starts or configuration is reloaded
2. It scans all connected servers for available tools
3. Each tool is checked against the discovery rules
4. Matching tools are automatically registered as direct aliases

## Combining Both Features

Tool Aliasing and Auto Tool Discovery can be used together:

1. Use Auto Tool Discovery for broad tool registration based on patterns
2. Use Tool Aliasing for specific tools requiring custom names or targeted access

## Backward Compatibility

For backward compatibility, the old configuration field names are still supported:

- `directTools` → `toolAliases` 
- `registrationPatterns` → `toolDiscoveryRules`

However, using the old names will generate deprecation warnings in the logs.
