#!/usr/bin/env node

/**
 * Example SSE/HTTP MCP Server for testing transport functionality
 * This is a simple test server that demonstrates how to create an MCP server
 * that can be accessed via SSE or HTTP transports.
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

// Create MCP Server
const server = new Server(
  {
    name: 'test-sse-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Add a simple test tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'test_tool',
      description: 'A simple test tool for transport testing',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'A test message',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'echo',
      description: 'Echo back the input',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to echo back',
          },
        },
        required: ['text'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'test_tool':
      return {
        content: [
          {
            type: 'text',
            text: `Test tool executed with message: ${args.message || 'No message provided'}`,
          },
        ],
      };

    case 'echo':
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${args.text || 'No text provided'}`,
          },
        ],
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// SSE endpoint
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/sse', res);
  await server.connect(transport);
  console.log('SSE client connected');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'test-sse-server' });
});

const port = process.env.TEST_SERVER_PORT || 3001;
app.listen(port, () => {
  console.log(`Test SSE MCP Server running on http://localhost:${port}`);
  console.log(`SSE endpoint: http://localhost:${port}/sse`);
  console.log(`Health check: http://localhost:${port}/health`);
});

export default app;
