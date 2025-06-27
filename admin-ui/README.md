# MCP Bridge Admin UI

Modern web-based admin interface for the MCP Bridge Server. Built with React, TypeScript, Vite, and TailwindCSS.

## Features

- **Real-time Dashboard**: Live server status monitoring and tool statistics
- **Server Management**: Add, edit, remove, and retry MCP servers with visual feedback
- **Tool Management**: View, create, and manage tool aliases with search and filtering
- **Global Settings**: Configure HTTP port, logging level, and server settings
- **Tool Discovery Settings**: Visual interface for managing auto-discovery rules
- **Responsive Design**: Modern UI that works on desktop and mobile devices

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- MCP Bridge Server running on localhost

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Configuration

The admin UI automatically detects the MCP Bridge Server port by trying common ports (3000, 3001, 3002, etc.) and connects to the first available server.

You can also manually specify the API base URL by setting the `VITE_API_BASE_URL` environment variable:

```bash
VITE_API_BASE_URL=http://localhost:3002 npm run dev
```

## Daemon Mode & Log Management

You can run the Admin UI as a background daemon using the built-in daemon manager:

```bash
npm run start:daemon      # Start as a background daemon
npm run stop:daemon       # Stop the daemon
npm run restart:daemon    # Restart the daemon
npm run status:daemon     # Show daemon status (PID)
npm run log -- -f -n 50   # View logs (tail compatible)
```

- The daemon writes stdout/stderr to `/var/run/mcp-bridge-admin-ui.log`.
- The default for `-n` is 20 lines.

## Technologies

- **React 18**: Modern React with hooks and function components
- **TypeScript**: Type safety and better development experience
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **React Query (@tanstack/react-query)**: Data fetching and caching
- **React Hook Form**: Form handling with validation
- **Axios**: HTTP client for API requests
- **Heroicons**: Beautiful SVG icons

## License

Same as the main MCP Bridge Server project - MIT License.
