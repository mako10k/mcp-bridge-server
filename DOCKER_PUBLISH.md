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
docker tag mcp-bridge:latest mako10k/mcp-bridge:v1.1.0

# Verify tags
docker images | grep mcp-bridge
```

### 3. Push to DockerHub
```bash
# Push latest tag
docker push mako10k/mcp-bridge:latest

# Push version tag
docker push mako10k/mcp-bridge:v1.1.0
```

### 4. Verify on DockerHub
Visit your DockerHub repository to confirm the images are uploaded:
https://hub.docker.com/r/mako10k/mcp-bridge

## Usage After Publishing

Users can now pull and run your image:

```bash
# Pull the image
docker pull mako10k/mcp-bridge:latest

# Run the container
docker run -d -p 3000:3000 mako10k/mcp-bridge:latest

# Or with custom configuration
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/mcp-config.json:/app/mcp-config.json:ro \
  mako10k/mcp-bridge:latest
```

## Image Details

- **Base Image**: node:20-alpine
- **Size**: ~146MB (production image)
- **Architecture**: linux/amd64
- **Security**: Non-root user, minimal attack surface
- **Health Check**: Built-in health endpoint at `/health`

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
