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
   cd admin-ui && npm install && cd ..
   ```
4. Build the project:
   ```bash
   npm run build
   cd admin-ui && npm run build && cd ..
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them:
   ```bash
   # Backend development
   npm run build
   npm start
   
   # Admin UI development (in another terminal)
   cd admin-ui
   npm run dev
   ```

3. Test with different configurations:
   ```bash
   # Test with sample configuration
   cp mcp-config.sample.json mcp-config.json
   npm start
   
   # Test with multi-transport config
   cp examples/mcp-config-multi-transport.json mcp-config.json
   npm start
   ```

4. Test the Admin UI:
   - Open http://localhost:5173 (Vite dev server)
   - Verify all pages work correctly
   - Test server management, tool management, and settings
   - Ensure real-time updates work

5. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. Push to your fork and create a pull request

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting and naming conventions
- Add JSDoc comments for public APIs
- Use meaningful commit messages following conventional commits format
- For React components, use function components with hooks
- Use TailwindCSS for styling in the admin UI

## Project Structure

- `src/` - Backend TypeScript source code
- `admin-ui/` - React-based admin interface
- `docs/` - Technical documentation
- `examples/` - Configuration examples
- `docker/` - Docker-related files

## Testing

- Test backend changes with different MCP servers
- Test admin UI changes across different browsers
- Verify API endpoints work correctly
- Check that configuration changes are applied dynamically
- Test localhost-only security binding

## Areas for Contribution

- **Admin UI Enhancements**: Improve user experience, add new features
- **New Transport Types**: Add support for additional MCP transport protocols
- **Configuration Management**: Improve validation and error handling
- **Performance Optimization**: Optimize connection management and request handling
- **Documentation**: Improve README, add more examples, create tutorials
- **Testing**: Add unit tests, integration tests, and e2e tests
- **Security**: Add authentication, authorization, and HTTPS support
- **Monitoring**: Add metrics, health checks, and observability features
- **Tool Management**: Enhance tool discovery and aliasing features

## Submitting Changes

1. Ensure your code builds without errors
2. Test your changes with different MCP servers
3. Test admin UI changes in the browser
4. Update documentation if needed
5. Create a pull request with a clear description of your changes

## Development Tips

- Use the admin UI for testing configuration changes
- Monitor logs for debugging connection issues
- Use the MCP Inspector at http://localhost:3002/mcp for protocol testing
- Test with both valid and invalid configurations
- Verify that security (localhost-only) binding works correctly

## Questions?

If you have questions, please:
- Check existing issues on GitHub
- Create a new issue with the "question" label
- Join discussions in existing issues

Thank you for contributing!
