import { useAuth } from '../hooks/useAuth';

export default function UserProfile() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-gray-700">{user.name || user.email}</span>
      <button className="text-primary-600" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
