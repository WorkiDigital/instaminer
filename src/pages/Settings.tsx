import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { InstagramConnection } from '../types/database';
import { startInstagramOAuth } from '../lib/instagramOAuth';
import {
  Camera, Link, Unlink, RefreshCw, Shield, Clock,
  AlertTriangle, CheckCircle, User, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [brandName, setBrandName] = useState(profile?.brand_name || '');
  const [brandTone, setBrandTone] = useState(profile?.brand_tone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [now] = useState(() => Date.now());

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('instagram_connections')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) console.error(error);
      setConnections(data || []);
    } catch (err) {
      console.error('Connections fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchConnections();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchConnections]);

  useEffect(() => {
    if (profile) {
      const timeoutId = setTimeout(() => {
        setFullName(profile.full_name || '');
        setBrandName(profile.brand_name || '');
        setBrandTone(profile.brand_tone || '');
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [profile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await updateProfile({
      full_name: fullName,
      brand_name: brandName,
      brand_tone: brandTone,
    });
    toast.success('Perfil atualizado!');
    setSavingProfile(false);
  };

  const getTokenStatus = (connection: InstagramConnection) => {
    if (!connection.token_expires_at) return { label: 'Sem expiração', color: 'var(--text-secondary)', icon: Clock };
    const expiresAt = new Date(connection.token_expires_at);
    const daysLeft = Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { label: 'Expirado', color: 'var(--error)', icon: AlertTriangle };
    if (daysLeft < 7) return { label: `Expira em ${daysLeft}d`, color: 'var(--warning)', icon: AlertTriangle };
    return { label: `Válido (${daysLeft}d)`, color: 'var(--success)', icon: CheckCircle };
  };

  const handleConnectInstagram = () => {
    startInstagramOAuth();
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta conta?')) return;
    
    try {
      const { error } = await supabase
        .from('instagram_connections')
        .delete()
        .eq('id', connectionId);
        
      if (error) throw error;
      
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      toast.success('Conta desconectada com sucesso');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao desconectar conta');
    }
  };

  return (
    <PageLayout
      title="Configurações"
      subtitle="Gerencie conexões, perfil e preferências"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
        {/* Profile */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: 'var(--brand-purple)' }} />
              <span style={{ fontWeight: 600 }}>Perfil</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label>Nome completo</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Nome da marca</label>
              <input className="input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Ex: Worki Digital" />
            </div>
            <div className="input-group">
              <label>Tom de voz da marca</label>
              <textarea
                className="textarea"
                value={brandTone}
                onChange={e => setBrandTone(e.target.value)}
                placeholder='Ex: "Profissional mas acessível, usa dados para convencer, evita jargões"'
                rows={3}
              />
              <span className="hint">Usado na geração de roteiros para manter consistência</span>
            </div>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile} style={{ alignSelf: 'flex-start' }}>
              {savingProfile ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> : <Save size={14} />}
              Salvar Perfil
            </button>
          </div>
        </div>

        {/* Instagram connections */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={16} style={{ color: 'var(--brand-pink)' }} />
              <span style={{ fontWeight: 600 }}>Conexões Instagram</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleConnectInstagram}>
              <Link size={14} />
              Conectar
            </button>
          </div>
          <div className="card-body">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map(i => (
                  <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
                ))}
              </div>
            ) : connections.length === 0 ? (
              <div style={{
                padding: 32, textAlign: 'center',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <Camera size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Nenhuma conta conectada
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Conecte sua conta Business/Creator para minerar e publicar
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {connections.map(conn => {
                  const tokenStatus = getTokenStatus(conn);
                  return (
                    <div
                      key={conn.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Camera size={20} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>@{conn.ig_username}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <span className="badge badge-info" style={{ fontSize: 10 }}>
                            {conn.account_type}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: tokenStatus.color }}>
                            <tokenStatus.icon size={12} />
                            {tokenStatus.label}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        title="Atualizar token"
                        onClick={handleConnectInstagram}
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        title="Desconectar" 
                        style={{ color: 'var(--error)' }}
                        onClick={() => handleDisconnect(conn.id)}
                      >
                        <Unlink size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* API Permissions info */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} style={{ color: 'var(--success)' }} />
              <span style={{ fontWeight: 600 }}>Permissões da API</span>
            </div>
          </div>
          <div className="card-body" style={{ fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { perm: 'instagram_business_basic', desc: 'Dados basicos da conta conectada' },
                { perm: 'instagram_business_content_publish', desc: 'Publicacao de conteudo' },
                { perm: 'instagram_business_manage_insights', desc: 'Metricas de performance' },
                { perm: 'Facebook Login + Pagina', desc: 'Necessario para Business Discovery' },
              ].map(p => (
                <div key={p.perm} style={{
                  padding: '8px 12px', background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <code style={{ fontSize: 11, color: 'var(--brand-purple)' }}>{p.perm}</code>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
