# MCP Bridge Configuration Hot Reload

This feature enhances MCP Bridge with advanced configuration management capabilities, including configuration hot reload and cross-platform support.

## Features

- **Hot Reload**: Automatically detect and apply configuration changes without restart
- **Cross-Platform Support**: Load configurations from platform-specific locations
- **Configuration Inheritance**: Merge configurations from multiple sources with priority system
- **Command Line Options**: Additional CLI options for configuration management

## Usage

### Command Line Options

```bash
# Basic usage with default config
npm start

# Specify a custom config file
npm start -- --config ./my-config.json

# Enable watch mode (auto reload on config changes)
npm start -- --watch

# Specify additional config files
npm start -- --config ./base-config.json --add-config ./overrides.json

# Debug mode
npm start -- --debug
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
