import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export function InstagramCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Conectando sua conta Instagram...');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void (async () => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error') || searchParams.get('error_reason');
        const savedState = sessionStorage.getItem('instagram_oauth_state');

        if (error) {
          setStatus('error');
          setMessage('A conexão foi cancelada ou recusada na Meta.');
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('A Meta não retornou o código de autorização.');
          return;
        }

        if (!state || state !== savedState) {
          setStatus('error');
          setMessage('Não foi possível validar a segurança da conexão. Tente novamente.');
          return;
        }

        const redirectUri = import.meta.env.VITE_META_REDIRECT_URI;
        if (!redirectUri) {
          setStatus('error');
          setMessage('VITE_META_REDIRECT_URI não está configurada.');
          return;
        }

        const { data, error: functionError } = await supabase.functions.invoke('instagram-oauth-callback', {
          body: { code, redirectUri },
        });

        if (functionError) {
          console.error(functionError);
          setStatus('error');
          setMessage(functionError.message || 'Erro ao finalizar conexão com Instagram.');
          return;
        }

        if (data && data.error) {
          console.error('Meta API Error:', data);
          setStatus('error');
          setMessage(data.error);
          return;
        }

        sessionStorage.removeItem('instagram_oauth_state');
        setStatus('success');
        setMessage('Instagram conectado com sucesso.');
        toast.success('Instagram conectado!');
        setTimeout(() => navigate('/settings'), 1200);
      })();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [navigate, searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-up" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{
          width: 56,
          height: 56,
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: status === 'error' ? 'var(--error-bg)' : 'var(--gradient-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {status === 'loading' && <Camera size={26} color="#fff" />}
          {status === 'success' && <CheckCircle size={28} color="#fff" />}
          {status === 'error' && <AlertTriangle size={28} style={{ color: 'var(--error)' }} />}
        </div>
        <h2 style={{ marginBottom: 8 }}>
          {status === 'loading' && 'Conectando Instagram'}
          {status === 'success' && 'Conta conectada'}
          {status === 'error' && 'Falha na conexão'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </p>
        {status === 'loading' && <div className="spinner-gradient" style={{ margin: '20px auto 0' }} />}
        {status === 'error' && (
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/settings')}>
            Voltar para configurações
          </button>
        )}
      </div>
    </div>
  );
}
