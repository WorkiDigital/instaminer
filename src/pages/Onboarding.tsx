import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Pickaxe, Camera, Users, ArrowRight, CheckCircle,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { startInstagramOAuth } from '../lib/instagramOAuth';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [step] = useState(1);

  const handleConnectInstagram = () => {
    startInstagramOAuth();
  };

  const handleSkipAudience = () => {
    navigate('/mine');
  };

  const handleFinish = () => {
    navigate('/mine');
    toast.success('Tudo pronto! Comece a minerar 🚀');
  };

  return (
    <div className="auth-page" style={{ background: 'var(--bg-surface)' }}>
      <div style={{ width: '100%', maxWidth: 560 }} className="animate-slide-up">
        {/* Progress */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 32, justifyContent: 'center',
        }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: step >= s ? 'var(--gradient-primary)' : 'var(--border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: step >= s ? '#fff' : 'var(--text-secondary)',
                transition: 'all 300ms ease',
              }}>
                {step > s ? <CheckCircle size={16} /> : s}
              </div>
              {s < 3 && (
                <div style={{
                  width: 40, height: 2,
                  background: step > s ? 'var(--brand-purple)' : 'var(--border-light)',
                  borderRadius: 1,
                  transition: 'all 300ms ease',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Welcome + Connect */}
        {step === 1 && (
          <div className="auth-card animate-slide-up">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="sidebar-logo" style={{
                width: 56, height: 56, margin: '0 auto 16px',
                borderRadius: 'var(--radius-lg)',
              }}>
                <Pickaxe size={28} color="#fff" />
              </div>
              <h2 style={{ marginBottom: 8 }}>
                Bem-vindo ao <span className="text-gradient">ContentMiner</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                {profile?.full_name ? `Olá, ${profile.full_name}! ` : ''}
                Vamos configurar sua conta em 2 passos rápidos.
              </p>
            </div>

            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24, textAlign: 'center',
              marginBottom: 16,
            }}>
              <Camera size={40} style={{ color: 'var(--brand-pink)', marginBottom: 8 }} />
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Conectar Instagram</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Conecte sua conta Business ou Creator para minerar perfis e publicar conteúdo.
              </p>
              <button className="btn btn-primary btn-lg" onClick={handleConnectInstagram} style={{ width: '100%' }}>
                <Camera size={18} />
                Conectar minha conta
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 12, background: 'var(--warning-bg)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12, color: 'var(--warning)',
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Sua conta precisa ser Business ou Creator. Contas pessoais não são suportadas.
            </div>
          </div>
        )}

        {/* Step 2: Create audience */}
        {step === 2 && (
          <div className="auth-card animate-slide-up">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--info-bg)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={28} style={{ color: 'var(--brand-purple)' }} />
              </div>
              <h2 style={{ marginBottom: 8 }}>Configure seu público</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Defina seu público-alvo para que a IA gere roteiros adaptados.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={() => { navigate('/audiences'); toast('Configure seu primeiro público-alvo!'); }}
              >
                <Users size={18} />
                Criar Público-Alvo
                <ChevronRight size={16} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleSkipAudience}
                style={{ width: '100%' }}
              >
                Pular por enquanto
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="auth-card animate-slide-up" style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--success-bg)', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ marginBottom: 8 }}>Tudo pronto!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Sua conta está configurada. Comece a minerar conteúdo de referência.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleFinish} style={{ width: '100%' }}>
              Começar a Minerar
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
