import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Pickaxe, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        if (!fullName.trim()) {
          setError('Informe seu nome completo');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setError(error);
        } else {
          setSuccess('Conta criada! Verifique seu email para confirmar o cadastro.');
        }
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-slide-up">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <div className="sidebar-logo">
              <Pickaxe size={22} color="#fff" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
              <span className="text-gradient">Content</span>Miner
            </span>
          </div>

          {/* Tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              type="button"
            >
              Entrar
            </button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              type="button"
            >
              Criar Conta
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', marginBottom: 16,
              background: 'var(--error-bg)', borderRadius: 'var(--radius-md)',
              fontSize: 13, color: 'var(--error)', fontWeight: 500,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '10px 14px', marginBottom: 16,
              background: 'var(--success-bg)', borderRadius: 'var(--radius-md)',
              fontSize: 13, color: 'var(--success)', fontWeight: 500,
            }}>
              {success}
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="input-group">
                <label>Nome completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }} />
                  <input
                    className="input"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    style={{ paddingLeft: 38 }}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }} />
                <input
                  className="input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: 38 }}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }} />
                <input
                  className="input"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: 38 }}
                  minLength={6}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? (
                <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center', marginTop: 24,
            fontSize: 12, color: 'var(--text-tertiary)',
          }}>
            Worki Digital © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
