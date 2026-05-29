import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-base)' }}>
        <div className="spinner-gradient" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/mine" replace />;
  }

  return <LoginForm />;
}
