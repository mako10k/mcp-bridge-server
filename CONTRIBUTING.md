# Contributing to MCP Bridge Server

Thank you for your interest in contributing to MCP Bridge Server! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/mcp-bridge.git
   cd mcp-bridge
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them:
   ```bash
   npm run build
   npm start
   ```

3. Test with different transport types:
   ```bash
   # Terminal 1: Start test SSE server
   npm run test-sse-server
   
   # Terminal 2: Start bridge with multi-transport config
   cp examples/mcp-config-multi-transport.json mcp-config.json
   npm start
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. Push to your fork and create a pull request

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting and naming conventions
- Add JSDoc comments for public APIs
- Use meaningful commit messages following conventional commits format

## Areas for Contribution

- **New Transport Types**: Add support for additional MCP transport protocols
- **Configuration Validation**: Improve configuration validation and error messages
- **Performance Optimization**: Optimize connection management and request handling
- **Documentation**: Improve README, add more examples, create tutorials
- **Testing**: Add unit tests, integration tests, and e2e tests
- **Monitoring**: Add metrics, health checks, and observability features
- **Security**: Improve authentication, authorization, and input validation

## Submitting Changes

1. Ensure your code builds without errors
2. Test your changes with different MCP servers
3. Update documentation if needed
4. Create a pull request with a clear description of your changes

## Questions?

If you have questions, please:
- Check existing issues on GitHub
- Create a new issue with the "question" label
- Join discussions in existing issues

Thank you for contributing!
