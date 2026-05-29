import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { MinePage } from './pages/Mine';
import { AudiencesPage } from './pages/Audiences';
import { PipelinePage } from './pages/Pipeline';
import { ContentDetailPage } from './pages/ContentDetail';
import { DashboardPage } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { OnboardingPage } from './pages/Onboarding';
import { InstagramCallbackPage } from './pages/InstagramCallback';
import './styles/globals.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              borderRadius: '8px',
              padding: '12px 16px',
            },
            success: {
              style: { background: '#F0FFF5', color: '#2ECC71', border: '1px solid #2ECC71' },
            },
            error: {
              style: { background: '#FFF0EE', color: '#E74C3C', border: '1px solid #E74C3C' },
            },
          }}
        />

        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route path="/onboarding" element={
            <ProtectedRoute><OnboardingPage /></ProtectedRoute>
          } />
          <Route path="/mine" element={
            <ProtectedRoute><MinePage /></ProtectedRoute>
          } />
          <Route path="/audiences" element={
            <ProtectedRoute><AudiencesPage /></ProtectedRoute>
          } />
          <Route path="/pipeline" element={
            <ProtectedRoute><PipelinePage /></ProtectedRoute>
          } />
          <Route path="/content/:id" element={
            <ProtectedRoute><ContentDetailPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          } />
          <Route path="/auth/instagram/callback" element={
            <ProtectedRoute><InstagramCallbackPage /></ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/mine" replace />} />
          <Route path="*" element={<Navigate to="/mine" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
