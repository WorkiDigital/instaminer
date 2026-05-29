import { useState, useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { useMining } from '../hooks/useMining';
import { usePipeline } from '../hooks/usePipeline';
import type { MinedProfile, MinedPost } from '../types/database';
import {
  Search, TrendingUp, Heart, MessageCircle, Eye,
  Sparkles, Plus, ExternalLink, AlertTriangle, Users, ChevronRight, Mic, Video
} from 'lucide-react';

export function MinePage() {
  const {
    searchLoading,
    savedPosts,
    savedProfile,
    analyzingPostId,
    searchProfile,
    loadSavedProfiles,
    loadProfilePosts,
    transcribePost,
  } = useMining();

  const { createItem } = usePipeline();

  const handleSendToPipeline = async (post: MinedPost) => {
    const title = post.analysis?.headline || (post.caption ? post.caption.substring(0, 50) + '...' : 'Ideia de conteúdo');
    
    // Convert TOFU/MOFU/BOFU to top/middle/bottom for the DB enum
    const rawStage = post.analysis?.funnel_stage?.toUpperCase() || '';
    let dbStage: 'top' | 'middle' | 'bottom' = 'top';
    if (rawStage === 'MOFU') dbStage = 'middle';
    if (rawStage === 'BOFU') dbStage = 'bottom';

    await createItem({
      title: title,
      source_mined_post_id: post.id,
      source_analysis: post.analysis,
      funnel_stage: dbStage,
      target_audience_id: null, // Will be selected in the Pipeline stage
    });
  };


  const [username, setUsername] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<MinedProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<MinedProfile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  const getShortcode = (permalink: string) => {
    const m = permalink.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
    return m?.[1] ?? null;
  };

  useEffect(() => {
    loadSavedProfiles().then(profiles => {
      setSavedProfiles(profiles);
      setLoadingProfiles(false);
    });
  }, [loadSavedProfiles]);

  // Quando um perfil é minerado e salvo, selecionamos ele automaticamente
  useEffect(() => {
    if (savedProfile) {
      setSelectedProfile(savedProfile);
      setSavedProfiles(prev => {
        const exists = prev.find(p => p.id === savedProfile.id);
        if (exists) {
          // Atualiza o existente
          return prev.map(p => p.id === savedProfile.id ? savedProfile : p);
        }
        // Adiciona no topo
        return [savedProfile, ...prev];
      });
      loadProfilePosts(savedProfile.id);
    }
  }, [savedProfile, loadProfilePosts]);

  const handleSearch = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await searchProfile(username.trim());
  };

  const handleSelectProfile = async (profile: MinedProfile) => {
    setSelectedProfile(profile);
    await loadProfilePosts(profile.id);
  };

  const ProfileAvatar = ({ url, username, size }: { url: string | null; username: string; size: number }) => {
    const fontSize = size <= 40 ? 14 : 22;
    const fallback = (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--gradient-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize, fontWeight: 700, flexShrink: 0,
      }}>
        {username[0].toUpperCase()}
      </div>
    );
    if (!url) return fallback;
    return (
      <img
        src={url}
        alt={username}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const div = document.createElement('div');
          div.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${fontSize}px;font-weight:700;flex-shrink:0`;
          div.textContent = username[0].toUpperCase();
          img.parentElement?.insertBefore(div, img);
        }}
      />
    );
  };

  const getPerformanceBadge = (ratio: number | null) => {
    if (!ratio) return null;
    if (ratio >= 2) return { label: '🔥 Viral', className: 'badge-error' };
    if (ratio >= 1.5) return { label: '⚡ Alto', className: 'badge-warning' };
    if (ratio >= 1) return { label: '✓ Acima', className: 'badge-success' };
    return { label: '↓ Abaixo', className: 'badge-info' };
  };

  const getMediaBadge = (mediaType: string | null, productType: string | null) => {
    const t = (productType || mediaType || '').toUpperCase();
    if (t === 'REELS' || t === 'REEL') return { label: 'REELS', color: '#7C3AED' };
    if (t === 'CAROUSEL_ALBUM' || t === 'CAROUSEL') return { label: 'CARROSSEL', color: '#0891B2' };
    if (t === 'IMAGE' || t === 'FOTO') return { label: 'FOTO', color: '#059669' };
    if (t === 'VIDEO' || t === 'FEED') return { label: 'VÍDEO', color: '#D97706' };
    return null;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    if (diff < 30) return `${diff}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <PageLayout
      title="Mineração"
      subtitle="Busque perfis de referência e analise o que performa"
    >
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Buscar perfil de expert</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }} />
                <input
                  className="input"
                  type="text"
                  placeholder="@username do expert (conta Business/Creator)"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={searchLoading || !username.trim()}
              style={{ height: 42 }}
            >
              {searchLoading ? (
                <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 16, height: 16 }} />
              ) : (
                <>
                  <Search size={16} />
                  Minerar
                </>
              )}
            </button>
          </div>
          <div style={{
            padding: '8px 20px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-tertiary)',
          }}>
            <AlertTriangle size={12} />
            Para minerar perfis de terceiros, a Meta exige Instagram Graph API com Facebook Login e uma Pagina conectada.
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Saved profiles list */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} style={{ color: 'var(--brand-purple)' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Perfis Salvos</span>
            </div>
            <span className="badge badge-info">{savedProfiles.length}</span>
          </div>
          <div style={{ padding: 8 }}>
            {loadingProfiles ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div className="spinner-gradient" style={{ margin: '0 auto' }} />
              </div>
            ) : savedProfiles.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <Search size={32} />
                <h3>Nenhum perfil salvo</h3>
                <p>Busque um @username acima para começar a minerar</p>
              </div>
            ) : (
              savedProfiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => handleSelectProfile(profile)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: selectedProfile?.id === profile.id ? 'var(--info-bg)' : 'transparent',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 150ms ease',
                    textAlign: 'left',
                  }}
                >
                  <ProfileAvatar url={profile.profile_picture_url} username={profile.ig_username} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                      @{profile.ig_username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {profile.followers_count?.toLocaleString() || '—'} seguidores
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Posts grid */}
        <div>
          {selectedProfile ? (
            <>
              {/* Profile header */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ProfileAvatar url={selectedProfile.profile_picture_url} username={selectedProfile.ig_username} size={56} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 18 }}>@{selectedProfile.ig_username}</h2>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span>{selectedProfile.followers_count?.toLocaleString() || '—'} seguidores</span>
                      <span>Média: {Math.round(selectedProfile.avg_likes || 0)} likes</span>
                      <span>{Math.round(selectedProfile.avg_comments || 0)} comentários</span>
                    </div>
                  </div>
                  <a
                    href={`https://instagram.com/${selectedProfile.ig_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    <ExternalLink size={14} />
                    Ver no Instagram
                  </a>
                </div>
              </div>

              {/* Posts */}
              {savedPosts.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <Eye size={40} />
                    <h3>Nenhum post minerado</h3>
                    <p>Os posts aparecerao aqui quando o Business Discovery estiver configurado via Facebook Login.</p>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 16,
                }}>
                  {savedPosts.map(post => {
                    const perfBadge = getPerformanceBadge(post.performance_ratio);
                    return (
                      <div key={post.id} className="card animate-slide-up">
                        {/* Embed / Thumbnail */}
                        {(() => {
                          const mediaBadge = getMediaBadge(post.media_type, (post as MinedPost & { media_product_type?: string }).media_product_type ?? null);
                          const shortcode = getShortcode(post.permalink);
                          const embedUrl = shortcode
                            ? `https://www.instagram.com/p/${shortcode}/embed/`
                            : null;

                          if (activeEmbedId === post.id && embedUrl) {
                            return (
                              <iframe
                                src={embedUrl}
                                style={{ width: '100%', height: 480, border: 'none', display: 'block' }}
                                allowFullScreen
                                loading="lazy"
                              />
                            );
                          }

                          return (
                            <div
                              onClick={() => embedUrl && setActiveEmbedId(post.id)}
                              style={{
                                height: 400, position: 'relative', overflow: 'hidden',
                                background: '#000',
                                cursor: embedUrl ? 'pointer' : 'default',
                                borderBottom: '1px solid var(--border-light)',
                              }}
                            >
                              {/* Badge de tipo no canto superior esquerdo */}
                              {mediaBadge && (
                                <div style={{
                                  position: 'absolute', top: 10, left: 10, zIndex: 2,
                                  background: mediaBadge.color, color: '#fff',
                                  fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                                  padding: '3px 8px', borderRadius: 4,
                                }}>
                                  {mediaBadge.label}
                                </div>
                              )}
                              {post.thumbnail_url && (
                                <img
                                  src={post.thumbnail_url}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              {/* Play button overlay */}
                              {embedUrl && (
                                <div style={{
                                  position: 'absolute', inset: 0,
                                  display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}>
                                  <div style={{
                                    width: 52, height: 52, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.92)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                                  }}>
                                    <Eye size={22} style={{ color: '#000' }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                    Clique para assistir
                                  </span>
                                </div>
                              )}
                              {!embedUrl && (
                                <div style={{
                                  position: 'absolute', inset: 0,
                                  display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center', gap: 12,
                                  background: 'var(--bg-surface)',
                                }}>
                                  <Video size={28} style={{ color: 'var(--text-tertiary)' }} />
                                  <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    onClick={e => e.stopPropagation()}>
                                    <ExternalLink size={13} /> Ver no Instagram
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="card-body" style={{ padding: 14 }}>
                          {/* Metrics row */}
                          <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                              <Heart size={14} style={{ color: 'var(--brand-pink)' }} />
                              {post.like_count?.toLocaleString() || 0}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                              <MessageCircle size={14} style={{ color: 'var(--brand-purple)' }} />
                              {post.comments_count?.toLocaleString() || 0}
                            </div>
                            {post.posted_at && (
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {formatDate(post.posted_at)}
                              </span>
                            )}
                            {perfBadge && (
                              <span className={`badge ${perfBadge.className}`} style={{ marginLeft: 'auto' }}>
                                {perfBadge.label}
                              </span>
                            )}
                          </div>

                          {/* Caption */}
                          {post.caption && (
                            <p style={{
                              fontSize: 12, color: 'var(--text-secondary)',
                              lineHeight: 1.5, marginBottom: 12,
                              display: '-webkit-box', WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {post.caption}
                            </p>
                          )}

                          {/* Transcript — só aparece quando transcrito via vídeo */}
                          {post.transcript_source === 'whisper' && post.transcript && (
                            <div style={{
                              background: 'var(--success-bg)',
                              border: '1px solid var(--success)',
                              borderRadius: 'var(--radius-sm)',
                              padding: 12, marginBottom: 12, fontSize: 12,
                            }}>
                              <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Mic size={12} />
                                Roteiro transcrito
                              </div>
                              <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                                {post.transcript}
                              </p>
                            </div>
                          )}

                          {/* Analysis Results */}
                          {post.is_analyzed && post.analysis ? (
                            <div style={{
                              background: '#F9FAFB', border: '1px solid var(--border-light)',
                              borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12,
                              fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, color: 'var(--brand-purple)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Sparkles size={12} />
                                  {post.transcript_source === 'whisper' ? 'Análise Gemini 2.5' : 'Análise'}
                                </span>
                                <span className="badge badge-info" style={{ fontSize: 10 }}>{post.analysis.funnel_stage}</span>
                              </div>
                              
                              <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Headline / Promessa</span>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{post.analysis.headline}</div>
                              </div>

                              <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Gancho ({post.analysis.hook?.technique})</span>
                                <div style={{ fontStyle: 'italic', borderLeft: '2px solid var(--brand-pink)', paddingLeft: 8, marginTop: 4, color: 'var(--text-secondary)' }}>
                                  "{post.analysis.hook?.text}"
                                </div>
                              </div>
                              
                              <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Chamada para Ação ({post.analysis.cta?.type})</span>
                                <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{post.analysis.cta?.text}</div>
                              </div>
                            </div>
                          ) : null}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {post.media_type !== 'IMAGE' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => transcribePost(post.id)}
                                disabled={analyzingPostId === post.id}
                                title="Selecione o arquivo MP4 do vídeo para transcrever com Whisper"
                                style={{ flex: 1 }}
                              >
                                {analyzingPostId === post.id ? (
                                  <div className="spinner" style={{ width: 14, height: 14 }} />
                                ) : (
                                  <>
                                    <Mic size={14} />
                                    {post.transcript_source === 'whisper' ? 'Re-transcrever' : 'Transcrever'}
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSendToPipeline(post)}
                              title="Adicionar ao Banco de Ideias no funil"
                            >
                              <Plus size={14} />
                              Banco de Ideias
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ minHeight: 400 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'var(--gradient-primary)', opacity: 0.15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <TrendingUp size={40} style={{ color: 'var(--brand-purple)', opacity: 1 }} />
                </div>
                <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>Comece a minerar</h3>
                <p style={{ maxWidth: 360, lineHeight: 1.6 }}>
                  Busque um perfil de referência ou selecione um perfil salvo para ver os posts minerados e suas análises estruturadas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>


      <style>{`
        @media (max-width: 768px) {
          .page-content > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageLayout>
  );
}
