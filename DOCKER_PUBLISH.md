# DockerHub Publishing Guide

## Prerequisites

1. DockerHub account (https://hub.docker.com/)
2. Docker logged in to DockerHub

## Publishing Steps

### 1. Login to DockerHub
```bash
docker login
# Enter your DockerHub username and password
```

### 2. Build and Tag Images
```bash
# Build the latest image
docker build -t mcp-bridge:latest .

# Tag for DockerHub (replace 'mako10k' with your DockerHub username)
docker tag mcp-bridge:latest mako10k/mcp-bridge:latest
docker tag mcp-bridge:latest mako10k/mcp-bridge:v1.4.0

# Verify tags
docker images | grep mcp-bridge
```

### 3. Push to DockerHub
```bash
# Push latest tag
docker push mako10k/mcp-bridge:latest

# Push version tag
docker push mako10k/mcp-bridge:v1.4.0
```

### 4. Verify on DockerHub
Visit your DockerHub repository to confirm the images are uploaded:
https://hub.docker.com/r/mako10k/mcp-bridge

## Usage After Publishing

Users can now pull and run your image:

```bash
# Pull the image
docker pull mako10k/mcp-bridge:latest

# Run the container (Note: Admin UI included)
docker run -d -p 3002:3002 mako10k/mcp-bridge:latest

# Or with custom configuration
docker run -d \
  -p 3002:3002 \
  -v $(pwd)/mcp-config.json:/app/mcp-config.json:ro \
  mako10k/mcp-bridge:latest

# Access the admin UI at http://localhost:3002
```

## Image Details

- **Base Image**: node:20-alpine
- **Size**: ~160MB (production image with admin UI)
- **Architecture**: linux/amd64
- **Security**: Localhost-only binding (127.0.0.1), non-root user, minimal attack surface
- **Health Check**: Built-in health endpoint at `/health`
- **Admin UI**: Web interface included at root path
- **Default Port**: 3002 (configurable via environment or config file)

## Automated Publishing (Optional)

Consider setting up GitHub Actions for automated Docker publishing:

```yaml
# .github/workflows/docker-publish.yml
name: Docker Publish

on:
  release:
    types: [published]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
          
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            mako10k/mcp-bridge:latest
            mako10k/mcp-bridge:${{ github.ref_name }}
```

Remember to add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` to your repository secrets.
</content>
</invoke>
