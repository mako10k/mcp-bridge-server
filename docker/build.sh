#!/bin/bash

# MCP Bridge Server Docker Build and Run Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Default values
ACTION="build"
ENV="production"
TAG="latest"
PUSH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -a, --action ACTION    Action to perform: build, run, stop, clean (default: build)"
            echo "  -e, --env ENV         Environment: production, development (default: production)"
            echo "  -t, --tag TAG         Docker image tag (default: latest)"
            echo "  -p, --push            Push image to registry after build"
            echo "  -h, --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --action build --env production --tag v1.0.0"
            echo "  $0 --action run --env development"
            echo "  $0 --action stop"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

IMAGE_NAME="mcp-bridge-server"
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

case $ACTION in
    build)
        print_status "Building Docker image: $FULL_IMAGE_NAME"
        
        if [ "$ENV" = "development" ]; then
            docker build -t "$FULL_IMAGE_NAME" --target builder .
        else
            docker build -t "$FULL_IMAGE_NAME" --target production .
        fi
        
        print_success "Docker image built successfully: $FULL_IMAGE_NAME"
        
        if [ "$PUSH" = true ]; then
            print_status "Pushing image to registry..."
            docker push "$FULL_IMAGE_NAME"
            print_success "Image pushed successfully"
        fi
        ;;
        
    run)
        print_status "Starting MCP Bridge Server with Docker Compose (${ENV} environment)"
        
        # Create logs directory if it doesn't exist
        mkdir -p logs
        
        if [ "$ENV" = "development" ]; then
            docker-compose -f docker-compose.dev.yml up -d
        else
            docker-compose up -d
        fi
        
        print_success "MCP Bridge Server started successfully"
        print_status "Service will be available at http://localhost:3000"
        print_status "Use 'docker-compose logs -f' to view logs"
        ;;
        
    stop)
        print_status "Stopping MCP Bridge Server"
        
        docker-compose -f docker-compose.yml down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        
        print_success "MCP Bridge Server stopped successfully"
        ;;
        
    clean)
        print_status "Cleaning up Docker resources"
        
        # Stop containers
        docker-compose -f docker-compose.yml down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        
        # Remove images
        docker rmi $(docker images "${IMAGE_NAME}" -q) 2>/dev/null || true
        
        # Clean up dangling images
        docker image prune -f
        
        print_success "Docker resources cleaned up successfully"
        ;;
        
    *)
        print_error "Unknown action: $ACTION"
        print_status "Available actions: build, run, stop, clean"
        exit 1
        ;;
esac
