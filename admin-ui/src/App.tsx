import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ServerManagement from './pages/ServerManagement';
import ToolManagement from './pages/ToolManagement';
import GlobalSettings from './pages/GlobalSettings';
import ToolDiscoverySettings from './pages/ToolDiscoverySettings';
import LogViewer from './pages/LogViewer';
import LoginPage from './components/LoginPage';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './contexts/AuthContext';

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
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route
                      path="/dashboard"
                      element={
                        <RequireAuth>
                          <Dashboard />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/servers"
                      element={
                        <RequireAuth>
                          <ServerManagement />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/tools"
                      element={
                        <RequireAuth>
                          <ToolManagement />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <RequireAuth>
                          <GlobalSettings />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/discovery"
                      element={
                        <RequireAuth>
                          <ToolDiscoverySettings />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/logs"
                      element={
                        <RequireAuth>
                          <LogViewer />
                        </RequireAuth>
                      }
                    />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
