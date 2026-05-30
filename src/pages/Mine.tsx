import { useState, useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { useMining } from '../hooks/useMining';
import { usePipeline } from '../hooks/usePipeline';
import { proxyImgUrl } from '../lib/supabase';
import type { MinedProfile, MinedPost } from '../types/database';
import {
  Search, TrendingUp, Heart, MessageCircle, Eye,
  Sparkles, Plus, ExternalLink, AlertTriangle, Users, ChevronRight, Mic, Video,
  Trash2, X
} from 'lucide-react';

const ProfileAvatar = ({ url, username, size }: { url: string | null; username: string; size: number }) => {
  const [hasError, setHasError] = useState(false);
  const fontSize = size <= 40 ? 14 : 22;
  const fallback = (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--gradient-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize, fontWeight: 700, flexShrink: 0,
    }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  );
  if (!url || hasError) return fallback;
  return (
    <img
      src={proxyImgUrl(url) ?? url}
      alt={username}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setHasError(true)}
    />
  );
};

export function MinePage() {
  const {
    searchLoading,
    postsLoading,
    savedPosts,
    savedProfile,
    analyzingPostId,
    searchProfile,
    loadSavedProfiles,
    loadProfilePosts,
    loadMorePosts,
    nextCursor,
    transcribePost,
    deleteProfile,
  } = useMining();

  const { createItem } = usePipeline();

  const handleSendToPipeline = async (post: MinedPost) => {
    const title = post.analysis?.headline || (post.caption ? post.caption.substring(0, 50) + '...' : 'Ideia de conteúdo');

    const rawStage = post.analysis?.funnel_stage?.toUpperCase() || '';
    let dbStage: 'top' | 'middle' | 'bottom' = 'top';
    if (rawStage === 'MOFU') dbStage = 'middle';
    if (rawStage === 'BOFU') dbStage = 'bottom';

    await createItem({
      title,
      source_mined_post_id: post.id,
      source_analysis: post.analysis,
      funnel_stage: dbStage,
      hook: post.analysis?.hook?.text || null,
      headline: post.analysis?.headline || null,
      cta: post.analysis?.cta?.text || null,
      target_audience_id: null,
    });
  };


  const [username, setUsername] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<MinedProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<MinedProfile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  const [profileToDelete, setProfileToDelete] = useState<MinedProfile | null>(null);
  const [visibleCount, setVisibleCount] = useState(9);
  const [sortBy, setSortBy] = useState<'recent' | 'likes' | 'comments' | 'views'>('recent');

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
    setVisibleCount(9);
    await loadProfilePosts(profile.id);
  };

  const handleDeleteProfileClick = (e: React.MouseEvent, profile: MinedProfile) => {
    e.stopPropagation();
    setProfileToDelete(profile);
  };

  const confirmDeleteProfile = async () => {
    if (!profileToDelete) return;
    const profileId = profileToDelete.id;
    const success = await deleteProfile(profileId);
    if (success) {
      setSavedProfiles(prev => prev.filter(p => p.id !== profileId));
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null);
      }
    }
    setProfileToDelete(null);
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
      fullWidth
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
        </div>
      </form>

      <div className="mine-layout-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Saved profiles list */}
        <div className="card" style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} style={{ color: 'var(--brand-purple)' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Perfis Salvos</span>
            </div>
            <span className="badge badge-info">{savedProfiles.length}</span>
          </div>
          <div className="custom-scrollbar" style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
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
                <div
                  key={profile.id}
                  onClick={() => handleSelectProfile(profile)}
                  className="profile-item-row"
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: selectedProfile?.id === profile.id ? 'var(--info-bg)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 150ms ease',
                    textAlign: 'left',
                  }}
                >
                  <ProfileAvatar url={profile.profile_picture_url} username={profile.ig_username} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>
                      @{profile.ig_username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {profile.followers_count?.toLocaleString() || '—'} seguidores
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      onClick={(e) => handleDeleteProfileClick(e, profile)}
                      className="profile-delete-btn"
                      title="Remover perfil"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 6,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  </div>
                </div>
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
                      {selectedProfile.last_synced_at && (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                          Sincronizado {formatDate(selectedProfile.last_synced_at)}
                        </span>
                      )}
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
                    <p>Mineração os posts deste perfil aparecerão aqui.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, margin: 0 }}>Posts Minerados</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Ordenar por:</label>
                      <select
                        className="input"
                        style={{ height: 36, padding: '0 12px', minWidth: 140 }}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                        <option value="recent">Mais recentes</option>
                        <option value="likes">Mais curtidas</option>
                        <option value="comments">Mais comentários</option>
                        <option value="views">Mais visualizações (vídeos)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 340px))',
                    gap: 16,
                  }}>
                    {[...savedPosts].sort((a, b) => {
                      if (sortBy === 'likes') return (b.like_count || 0) - (a.like_count || 0);
                      if (sortBy === 'comments') return (b.comments_count || 0) - (a.comments_count || 0);
                      if (sortBy === 'views') return (b.video_view_count || 0) - (a.video_view_count || 0);
                      return new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime();
                    }).slice(0, visibleCount).map(post => {
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
                                <div style={{ position: 'relative' }}>
                                  <iframe
                                    src={embedUrl}
                                    style={{ width: '100%', height: 480, border: 'none', display: 'block' }}
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                </div>
                              );
                            }

                            return (
                              <div
                                onClick={() => embedUrl && setActiveEmbedId(post.id)}
                                style={{
                                  height: 320, position: 'relative', overflow: 'hidden',
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
                              {post.video_view_count != null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                  <Eye size={14} style={{ color: 'var(--brand-violet)' }} />
                                  {post.video_view_count.toLocaleString()}
                                </div>
                              )}
                              {post.posted_at && (
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                  {formatDate(post.posted_at)}
                                </span>
                              )}
                              {/* Badge de fonte de transcrição */}
                              {post.transcript_source === 'whisper' && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 6px', borderRadius: 4 }}>🎙 Whisper</span>
                              )}
                              {perfBadge && (
                                <span className={`badge ${perfBadge.className}`} style={{ marginLeft: 'auto' }}>
                                  {perfBadge.label}
                                </span>
                              )}
                            </div>



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
                                    {post.transcript_source === 'whisper' ? 'Análise Gemini 2.5' : 'Análise da Legenda'}
                                  </span>
                                  <span className="badge badge-info" style={{ fontSize: 10 }}>{post.analysis.funnel_stage}</span>
                                </div>

                                {post.caption && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Legenda Completa</span>
                                    <div className="custom-scrollbar" style={{
                                      fontSize: 12, color: 'var(--text-primary)',
                                      lineHeight: 1.5, marginTop: 4,
                                      maxHeight: 120, overflowY: 'auto',
                                      whiteSpace: 'pre-wrap', paddingRight: 4,
                                      background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
                                      borderRadius: 'var(--radius-sm)', padding: 8
                                    }}>
                                      {post.caption}
                                    </div>
                                  </div>
                                )}

                                {/* Headline só aparece quando a IA teve acesso ao vídeo real */}
                                {post.transcript_source === 'whisper' && post.analysis.headline && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Headline / Promessa</span>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{post.analysis.headline}</div>
                                  </div>
                                )}

                                {/* Gancho só aparece com transcrição real (da thumbnail/voz, não da legenda) */}
                                {post.transcript_source === 'whisper' && post.analysis.hook?.text && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Gancho ({post.analysis.hook?.technique})</span>
                                    <div style={{ fontStyle: 'italic', borderLeft: '2px solid var(--brand-pink)', paddingLeft: 8, marginTop: 4, color: 'var(--text-secondary)' }}>
                                      "{post.analysis.hook?.text}"
                                    </div>
                                  </div>
                                )}

                                {post.analysis.cta?.text && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Chamada para Ação ({post.analysis.cta?.type})</span>
                                    <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{post.analysis.cta?.text}</div>
                                  </div>
                                )}

                                {/* Estrutura do corpo */}
                                {post.analysis.body_structure && (Array.isArray(post.analysis.body_structure) ? post.analysis.body_structure.length > 0 : post.analysis.body_structure) && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Estrutura do Conteúdo</span>
                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {Array.isArray(post.analysis.body_structure)
                                        ? post.analysis.body_structure.map((step, i) => (
                                          <div key={i} style={{ fontSize: 11, color: 'var(--text-primary)', display: 'flex', gap: 6 }}>
                                            <span style={{ color: 'var(--brand-purple)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                            <span>{step}</span>
                                          </div>
                                        ))
                                        : <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{post.analysis.body_structure as string}</div>
                                      }
                                    </div>
                                  </div>
                                )}

                                {/* Tema principal */}
                                {post.analysis.main_theme && (
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Tema Principal</span>
                                    <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 2 }}>{post.analysis.main_theme}</div>
                                  </div>
                                )}

                                {/* Aviso quando análise foi feita só por legenda */}
                                {post.transcript_source !== 'whisper' && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 8px',
                                    background: 'var(--warning-bg)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 11, color: 'var(--warning)',
                                  }}>
                                    <Mic size={11} />
                                    Transcreva o vídeo para ver headline e gancho reais
                                  </div>
                                )}
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
                </>
              )}

              {(visibleCount < savedPosts.length || (nextCursor && selectedProfile?.id === savedProfile?.id)) && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 24 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (visibleCount < savedPosts.length) {
                        setVisibleCount(v => v + 9);
                      } else {
                        loadMorePosts();
                      }
                    }}
                    disabled={postsLoading}
                    style={{ minWidth: 200 }}
                  >
                    {postsLoading ? (
                      <div className="spinner" style={{ width: 16, height: 16 }} />
                    ) : (
                      `Ver mais (${Math.min(9, savedPosts.length - visibleCount) || ''} posts)`
                    )}
                  </button>
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


      {/* Custom Confirmation Modal */}
      {profileToDelete && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setProfileToDelete(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header" style={{ borderBottom: 'none', padding: '20px 24px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--error-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--error)'
                }}>
                  <AlertTriangle size={18} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Remover Perfil</h3>
              </div>
              <button className="btn-icon" onClick={() => setProfileToDelete(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0 24px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Tem certeza de que deseja remover o perfil de <strong style={{ color: 'var(--text-primary)' }}>@{profileToDelete.ig_username}</strong>?
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8 }}>
                Esta ação é irreversível. Todos os posts minerados, transcrições e análises vinculados a ele serão perdidos permanentemente.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', padding: '10px 24px 20px', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setProfileToDelete(null)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteProfile} style={{ flex: 1 }}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .profile-item-row {
          transition: background-color 150ms ease;
        }
        .profile-item-row:hover {
          background-color: var(--bg-surface) !important;
        }
        .profile-delete-btn:hover {
          color: var(--error) !important;
          background-color: var(--error-bg) !important;
        }
        @media (max-width: 768px) {
          .mine-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageLayout>
  );
}
