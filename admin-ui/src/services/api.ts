import axios from 'axios';

/**
 * Dynamically detect the MCP Bridge Server port
 */
async function detectMCPBridgePort(): Promise<string> {
  // Common ports to try
  const portsToTry = [3001, 3000, 3002, 3003, 8080];
  
  for (const port of portsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://localhost:${port}/mcp/server-info`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'running') {
          console.log(`MCP Bridge Server detected on port ${port}`);
          return `http://localhost:${port}`;
        }
      }
    } catch (error) {
      // Port not responding, try next
      continue;
    }
  }
  
  // Fallback to default
  console.warn('Could not detect MCP Bridge Server port, using default 3001');
  return 'http://localhost:3001';
}

// Initialize API base URL
let API_BASE_URL: string;

if (import.meta.env.MODE === 'production') {
  API_BASE_URL = ''; // In production, assume same origin
} else {
  // Development - use VITE_API_BASE_URL or fallback to default
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

  // Log the selected API base URL
  console.log(`Using API base URL: ${API_BASE_URL}`);
}

// Create axios instance with the base URL
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling and port detection retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Prevent infinite retry loops
    if (error.config._retry) {
      console.error('API Error (retry failed):', error.response?.data || error.message);
      return Promise.reject(error);
    }
    
    // If connection refused, try to auto-detect the correct port
    if (error.code === 'ECONNREFUSED' || error.response?.status === undefined) {
      console.warn('Connection failed, attempting to detect correct MCP Bridge Server port...');
      
      try {
        const newBaseURL = await detectMCPBridgePort();
        if (newBaseURL !== api.defaults.baseURL) {
          api.defaults.baseURL = newBaseURL;
          console.log(`Retrying with detected port: ${newBaseURL}`);
          
          // Mark this request as a retry to prevent infinite loops
          error.config._retry = true;
          error.config.baseURL = newBaseURL;
          
          // Retry the original request with new base URL
          return api.request(error.config);
        }
      } catch (detectError) {
        console.error('Failed to detect MCP Bridge Server port:', detectError);
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
