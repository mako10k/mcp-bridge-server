import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user, login, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-4 text-2xl font-semibold">MCP Bridge Admin Login</h1>
      <button
        className="rounded bg-primary-600 px-4 py-2 font-medium text-white"
        onClick={() => login()}
      >
        Login with OAuth2
      </button>
    </div>
  );
}
