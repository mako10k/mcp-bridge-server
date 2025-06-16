# MCP Bridge Configuration Hot Reload - Implementation Complete

This feature provides advanced configuration management capabilities, including configuration hot reload and runtime configuration updates.

## ✅ Implemented Features

- **Hot Reload**: ✅ Automatically detect and apply configuration file changes without restart
- **Runtime Updates**: ✅ Update configuration via REST API endpoints 
- **Dynamic Server Management**: ✅ Add, update, remove servers without restart
- **Global Settings**: ✅ Update HTTP port, logging, and other settings at runtime
- **Tool Discovery Rules**: ✅ Update tool discovery patterns dynamically
- **Configuration Validation**: ✅ Zod-based schema validation for all config changes

## Usage

### REST API Configuration Management

```bash
# Get current global configuration
curl http://localhost:3002/mcp/config/global

# Update global configuration
curl -X PUT http://localhost:3002/mcp/config/global \
  -H "Content-Type: application/json" \
  -d '{"logLevel": "debug", "httpPort": 3003}'

# Add a new server
curl -X POST http://localhost:3002/mcp/config/servers \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "new-server",
    "config": {
      "name": "new-server",
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "enabled": true
    }
  }'

# Update tool discovery rules
curl -X PUT http://localhost:3002/mcp/config/discovery-rules \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "serverPattern": "git*",
        "toolPattern": "git_*",
        "exclude": false
      }
    ]
  }'
```
```

### Configuration Sources

The system looks for configuration files in the following locations (in order of increasing priority):

1. Global configuration:
   - Linux: `/etc/mcp-bridge/config.json`
   - macOS: Not applicable
   - Windows: Not applicable

2. Platform-specific user configuration:
   - Linux: `~/.config/mcp-bridge/config.json`
   - macOS: `~/Library/Application Support/mcp-bridge/config.json`
   - Windows: `%APPDATA%\mcp-bridge\config.json`

3. User configuration: `~/.mcp-bridge/config.json`

4. Local project configuration: `./mcp-config.json` (or specified with `--config`)

5. Additional configurations: Specified with `--add-config` option

## Configuration Events

The configuration manager emits the following events:

- `config-loaded`: When configuration is initially loaded
- `config-reloaded`: When configuration is reloaded after a change
- `config-error`: When an error occurs during configuration loading or reloading

## Example Configuration Files

### Base Configuration (mcp-config.json)

```json
{
  "servers": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "enabled": true
    }
  ]
}
```

### Override Configuration (dev-config.json)

```json
{
  "servers": [
    {
      "name": "filesystem",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/dev-tmp"],
      "env": {
        "DEBUG": "true"
      }
    }
  ]
}
```

When using both files:
```
npm start -- --config ./mcp-config.json --add-config ./dev-config.json --watch
```

The filesystem server will use `/dev-tmp` path and have the DEBUG environment variable set to "true".

## Development Workflow

1. Start MCP Bridge with watch mode: `npm start -- --watch`
2. Make changes to your configuration file
3. The changes will be automatically detected and applied
4. Check the console output for confirmation

This feature makes development much faster, as it eliminates the need to restart the server after configuration changes.
