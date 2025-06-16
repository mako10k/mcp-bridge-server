import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ServerManagement from './pages/ServerManagement';
import ToolManagement from './pages/ToolManagement';
import GlobalSettings from './pages/GlobalSettings';
import LogViewer from './pages/LogViewer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/servers" element={<ServerManagement />} />
            <Route path="/tools" element={<ToolManagement />} />
            <Route path="/settings" element={<GlobalSettings />} />
            <Route path="/logs" element={<LogViewer />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
