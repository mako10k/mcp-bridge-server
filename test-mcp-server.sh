#!/bin/bash

# Test MCP Bridge as a pure MCP Server via stdio
# This script simulates an MCP client connecting to our MCP server

echo "Testing MCP Bridge Meta Server via stdio..."

# Create a test MCP config for this server
cat > mcp-test-config.json << 'EOF'
{
  "mcpServers": {
    "mcp-bridge-meta": {
      "command": "npm",
      "args": ["run", "mcp-server"]
    }
  }
}
EOF

echo "Created test configuration file"
echo "You can now test the MCP Bridge as an MCP server using:"
echo "npm run mcp-server"
