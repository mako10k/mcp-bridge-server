# Multi-stage build for MCP Bridge Server
FROM node:20-alpine AS builder

# Metadata
LABEL org.opencontainers.image.title="MCP Bridge Server"
LABEL org.opencontainers.image.description="HTTP gateway for multiple STDIO-based MCP servers with multi-transport support and tool conflict resolution"
LABEL org.opencontainers.image.version="1.5.0"
LABEL org.opencontainers.image.source="https://github.com/mako10k/mcp-bridge-server"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpbridge -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --chown=mcpbridge:nodejs docker/mcp-config.docker.json ./mcp-config.json

# Create logs directory
RUN mkdir -p logs && chown mcpbridge:nodejs logs

# Switch to non-root user
USER mcpbridge

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({hostname: 'localhost', port: 3000, path: '/health', timeout: 2000}, (res) => { \
      if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/index.js"]
