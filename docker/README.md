# MCP Bridge Server - Docker Documentation

This directory contains Docker configuration files and utilities for running MCP Bridge Server in containerized environments.

## Quick Start

### Using Docker Compose (Recommended)

1. **Production deployment:**
   ```bash
   # Build and start the service
   npm run docker:run
   
   # Or using docker-compose directly
   docker-compose up -d
   ```

2. **Development environment:**
   ```bash
   # Build and start development environment with live reload
   npm run docker:run:dev
   
   # Or using docker-compose directly
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Stop the service:**
   ```bash
   npm run docker:stop
   ```

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t mcp-bridge-server .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name mcp-bridge \
     -p 3000:3000 \
     -v $(pwd)/mcp-config.json:/app/mcp-config.json:ro \
     -v $(pwd)/logs:/app/logs \
     mcp-bridge-server
   ```

## Configuration

### Environment Variables

- `NODE_ENV`: Environment mode (`production`, `development`)
- `LOG_LEVEL`: Logging level (`error`, `warn`, `info`, `debug`)
- `CONFIG_PATH`: Path to MCP configuration file (default: `/app/mcp-config.json`)
- `PORT`: Server port (default: `3000`)

### Volume Mounts

- **Configuration**: Mount your `mcp-config.json` to `/app/mcp-config.json`
- **Logs**: Mount logs directory to `/app/logs` for persistence
- **MCP Servers**: Optionally mount additional MCP server binaries to `/app/mcp-servers`

### Configuration File

Use the provided `docker/mcp-config.docker.json` as a starting point:

```bash
cp docker/mcp-config.docker.json mcp-config.json
# Edit mcp-config.json with your MCP server configurations
```

## Docker Files

### Core Files

- **`Dockerfile`**: Multi-stage production Docker image
- **`docker-compose.yml`**: Production Docker Compose configuration
- **`docker-compose.dev.yml`**: Development Docker Compose configuration
- **`.dockerignore`**: Files excluded from Docker context

### Utilities

- **`docker/build.sh`**: Advanced build and deployment script
- **`docker/mcp-config.docker.json`**: Docker-optimized configuration example

## Build Script Usage

The `docker/build.sh` script provides advanced Docker operations:

```bash
# Build production image
./docker/build.sh --action build --env production --tag v1.0.0

# Build and push to registry
./docker/build.sh --action build --tag v1.0.0 --push

# Run development environment
./docker/build.sh --action run --env development

# Clean up all Docker resources
./docker/build.sh --action clean

# View help
./docker/build.sh --help
```

## Health Checks

The container includes built-in health checks:

- **Endpoint**: `http://localhost:3000/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

Check health status:
```bash
docker ps  # Shows health status
curl http://localhost:3000/health
```

## Multi-Service Setup

To run multiple MCP servers as separate containers:

1. **Create a custom docker-compose.yml:**
   ```yaml
   version: '3.8'
   services:
     mcp-bridge:
       # ... (main service configuration)
     
     mcp-filesystem:
       image: your-filesystem-mcp-server:latest
       networks:
         - mcp-network
         
     mcp-search:
       image: your-search-mcp-server:latest
       networks:
         - mcp-network
       environment:
         - API_KEY=${SEARCH_API_KEY}
   ```

2. **Update MCP configuration** to use container hostnames:
   ```json
   {
     "servers": [
       {
         "id": "filesystem",
         "transport": "http",
         "url": "http://mcp-filesystem:3001/mcp"
       },
       {
         "id": "search",
         "transport": "sse",
         "url": "http://mcp-search:3002/sse"
       }
     ]
   }
   ```

## Security Considerations

### Production Deployment

1. **Non-root user**: Container runs as user `mcpbridge` (UID 1001)
2. **Read-only configuration**: Mount config files as read-only
3. **Resource limits**: Set appropriate CPU/memory limits
4. **Network isolation**: Use custom Docker networks
5. **Secret management**: Use Docker secrets or environment files for API keys

### Example with resource limits:
```yaml
services:
  mcp-bridge:
    # ... other configuration
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Troubleshooting

### Common Issues

1. **Permission denied errors:**
   ```bash
   # Ensure correct ownership of mounted volumes
   sudo chown -R 1001:1001 logs/
   ```

2. **Configuration not found:**
   ```bash
   # Verify mount path
   docker exec mcp-bridge ls -la /app/mcp-config.json
   ```

3. **Port already in use:**
   ```bash
   # Change port mapping
   docker-compose down
   # Edit docker-compose.yml to use different port
   docker-compose up -d
   ```

### Logs and Debugging

```bash
# View container logs
docker-compose logs -f mcp-bridge

# Access container shell
docker exec -it mcp-bridge sh

# Check health status
docker inspect mcp-bridge | grep -A 10 Health
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build and push Docker image
  run: |
    docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
    docker push ghcr.io/${{ github.repository }}:${{ github.sha }}

- name: Deploy to production
  run: |
    docker-compose -f docker-compose.prod.yml up -d
```

### Environment-specific Configurations

Create different compose files for each environment:
- `docker-compose.yml` (production)
- `docker-compose.dev.yml` (development) 
- `docker-compose.test.yml` (testing)
- `docker-compose.prod.yml` (production with additional services)
