import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import { useAudiences } from '../hooks/useAudiences';
import type { ContentItem, ContentStatus, FunnelStage, PostAnalysis } from '../types/database';
import {
  ArrowLeft, Sparkles, Save, Send, Upload,
  CheckCircle, Copy, Eye, FileText, Target, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AutoResizeTextarea } from '../components/ui/AutoResizeTextarea';

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { audiences } = useAudiences();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishCaption, setPublishCaption] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [hook, setHook] = useState('');
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('');
  const [funnelStage, setFunnelStage] = useState<FunnelStage>('top');
  const [audienceId, setAudienceId] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('content_items')
        .select(`
          *,
          mined_posts (
            caption,
            transcript,
            media_type,
            media_product_type
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Item não encontrado');
        navigate('/pipeline');
        return;
      }

      // @ts-ignore
      const postRef = data.mined_posts;
      // @ts-ignore
      setItem({ ...data, mined_posts: postRef });
      setTitle(data.title || '');
      setScript(data.generated_script || '');

      // Se os campos estruturados estiverem vazios, tenta preencher da source_analysis
      const sa = data.source_analysis as PostAnalysis | null;
      setHook(data.hook || sa?.hook?.text || '');
      setHeadline(data.headline || sa?.headline || '');
      setCta(data.cta || sa?.cta?.text || '');

      setFunnelStage((data.funnel_stage as FunnelStage) || 'top');
      setAudienceId(data.target_audience_id || '');
      setLoading(false);
    })();
  }, [id, navigate]);

  // Pré-seleciona público padrão se nenhum estiver selecionado
  useEffect(() => {
    if (!audienceId && audiences.length > 0) {
      const defaultAudience = audiences.find(a => a.is_default) || audiences[0];
      if (defaultAudience) setAudienceId(defaultAudience.id);
    }
  }, [audiences, audienceId]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from('content_items')
      .update({
        title,
        generated_script: script,
        hook,
        headline,
        cta,
        funnel_stage: funnelStage,
        target_audience_id: audienceId || null,
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Salvo!');
    }
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!audienceId) {
      toast.error('Por favor, selecione um Público-Alvo primeiro!');
      return;
    }

    setGenerating(true);
    const toastId = toast.loading('Criando roteiro genial com IA...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: { 
          content_item_id: id,
          target_audience_id: audienceId
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao chamar função');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data.result;
      
      // Update local state
      setScript(result.script || '');
      setHook(result.new_hook || '');
      setHeadline(result.new_headline || '');
      setCta(result.new_cta || '');
      
      toast.success('Roteiro gerado com sucesso!', { id: toastId });
      
      // Also update the parent item so pipeline syncs
      setItem(prev => prev ? { 
        ...prev, 
        generated_script: result.script,
        hook: result.new_hook,
        headline: result.new_headline,
        cta: result.new_cta,
        status: prev.status === 'idea_bank' ? 'modeled' : prev.status
      } : null);

    } catch (err: any) {
      console.error('Erro na geração:', err);
      toast.error(err.message || 'Falha ao gerar roteiro', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!id || !item) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Vídeo muito grande. Máximo 100MB.');
      return;
    }
    // Garante user_id via sessão se não vier no item
    const { data: { user } } = await supabase.auth.getUser();
    const userId = item.user_id || user?.id;
    if (!userId) {
      toast.error('Sessão expirada. Recarregue a página.');
      return;
    }
    setUploading(true);
    const toastId = toast.loading('Enviando vídeo...');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `videos/${userId}/${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from('content_items')
        .update({ video_storage_path: path })
        .eq('id', id);
      if (updateError) throw updateError;
      setItem(prev => prev ? { ...prev, video_storage_path: path } : null);
      toast.success('Vídeo enviado!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar vídeo', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleAdvance = async (newStatus: ContentStatus) => {
    if (!id) return;
    const { error } = await supabase
      .from('content_items')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao avançar');
    } else {
      toast.success('Status atualizado!');
      setItem(prev => prev ? { ...prev, status: newStatus as ContentItem['status'] } : null);
    }
  };

  const handleMarkAsPosted = async () => {
    if (!id) return;
    const { error } = await supabase
      .from('content_items')
      .update({
        status: 'posted',
        publish_method: 'manual',
        posted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao marcar como postado');
    } else {
      toast.success('Marcado como postado!');
      setItem(prev => prev ? { ...prev, status: 'posted', publish_method: 'manual' } : null);
    }
  };

  const handlePublishToInstagram = async () => {
    if (!id || !item) return;
    if (!item.video_storage_path) {
      toast.error('Faça o upload do vídeo antes de publicar.');
      return;
    }
    setShowPublishModal(false);
    setPublishing(true);
    const toastId = toast.loading('Publicando no Instagram... (aguarde até 1 min)');
    try {
      const { data, error } = await supabase.functions.invoke('publish-to-instagram', {
        body: { content_item_id: id, caption: publishCaption },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success('Publicado no Instagram!', { id: toastId });
      setItem(prev => prev ? { ...prev, status: 'posted', ig_media_id: data.ig_media_id } : null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao publicar', { id: toastId });
    } finally {
      setPublishing(false); // sempre desbloqueia o botão
    }
  };

  if (loading) {
    return (
      <PageLayout title="Carregando...">
        <div className="flex-center" style={{ height: 400 }}>
          <div className="spinner-gradient" />
        </div>
      </PageLayout>
    );
  }

  if (!item) return null;

  const analysis = item.source_analysis as PostAnalysis | null;
  // @ts-ignore
  const minedPost = item.mined_posts as { caption?: string; transcript?: string; media_type?: string; media_product_type?: string } | null;

  const getMediaBadge = (mediaType?: string, productType?: string) => {
    const t = (productType || mediaType || '').toUpperCase();
    if (t === 'REELS' || t === 'REEL') return { label: 'REELS', color: '#7C3AED' };
    if (t === 'CAROUSEL_ALBUM' || t === 'CAROUSEL') return { label: 'CARROSSEL', color: '#0891B2' };
    if (t === 'IMAGE' || t === 'FOTO') return { label: 'FOTO', color: '#059669' };
    if (t === 'VIDEO' || t === 'FEED') return { label: 'VÍDEO', color: '#D97706' };
    return null;
  };

  const mediaBadge = getMediaBadge(minedPost?.media_type ?? undefined, minedPost?.media_product_type ?? undefined);

  return (
    <PageLayout
      title={title || 'Detalhe do Conteúdo'}
      subtitle={`Status: ${item.status.replace('_', ' ')}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pipeline')}>
            <ArrowLeft size={14} />
            Pipeline
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bloco 1: Material de Referência — sempre visível se vier de mineração */}
          {item.source_mined_post_id && (minedPost?.transcript || minedPost?.caption) && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} style={{ color: 'var(--brand-purple)' }} />
                  <span style={{ fontWeight: 600 }}>Material de Referência</span>
                  {mediaBadge && (
                    <span style={{
                      background: mediaBadge.color, color: '#fff',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                      padding: '2px 8px', borderRadius: 4,
                    }}>
                      {mediaBadge.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Roteiro transcrito — prioridade máxima */}
              {minedPost?.transcript && (
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-purple)', textTransform: 'uppercase', marginBottom: 6 }}>
                    🎙 Roteiro Transcrito (modelo para modelagem)
                  </div>
                  <div className="custom-scrollbar" style={{
                    fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
                    lineHeight: 1.7, background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)', padding: 16,
                    maxHeight: 320, overflowY: 'auto',
                  }}>
                    {minedPost.transcript}
                  </div>
                </div>
              )}

              {/* Legenda — só se não tiver transcrição */}
              {!minedPost?.transcript && minedPost?.caption && (
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                    📝 Legenda Original
                  </div>
                  <div className="custom-scrollbar" style={{
                    fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
                    lineHeight: 1.7, background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)', padding: 16,
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {minedPost.caption}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bloco 2: Análise Estrutural — só aparece se tiver analysis */}
          {analysis && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} style={{ color: 'var(--brand-violet)' }} />
                  <span style={{ fontWeight: 600 }}>Estrutura Analisada</span>
                </div>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {analysis.hook?.text && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Gancho</div>
                    <p style={{ fontSize: 13 }}>{analysis.hook.text}</p>
                    <span className="badge badge-info" style={{ marginTop: 4 }}>{analysis.hook.technique}</span>
                  </div>
                )}
                {analysis.headline && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Headline</div>
                    <p style={{ fontSize: 13 }}>{analysis.headline}</p>
                  </div>
                )}
                {analysis.promise && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Promessa</div>
                    <p style={{ fontSize: 13 }}>{analysis.promise}</p>
                  </div>
                )}
                {analysis.cta?.text && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>CTA</div>
                    <p style={{ fontSize: 13 }}>{analysis.cta.text}</p>
                    <span className="badge badge-success" style={{ marginTop: 4 }}>{analysis.cta.type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="card">
            <div className="card-body">
              <div className="input-group">
                <label>Título do conteúdo</label>
                <input
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: 5 erros que donos de loja cometem ao anunciar"
                />
              </div>
            </div>
          </div>

          {/* Script */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--brand-violet)' }} />
                <span style={{ fontWeight: 600 }}>Roteiro</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                ) : (
                  <>
                    <Sparkles size={14} />
                    Gerar com IA
                  </>
                )}
              </button>
            </div>
            <div className="card-body">
              <AutoResizeTextarea
                className="textarea"
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="O roteiro gerado pela IA aparecerá aqui. Você também pode escrever ou editar manualmente."
                rows={12}
              />
              {script && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => { navigator.clipboard.writeText(script); toast.success('Copiado!'); }}
                >
                  <Copy size={14} />
                  Copiar roteiro
                </button>
              )}
            </div>
          </div>

          {/* Upload & Publish */}
          {(item.status === 'in_production' || item.status === 'modeled') && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={16} style={{ color: 'var(--brand-pink)' }} />
                  <span style={{ fontWeight: 600 }}>Vídeo & Publicação</span>
                </div>
              </div>
              <div className="card-body">
                {/* Upload area */}
                <label style={{
                  border: `2px dashed ${item.video_storage_path ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 40, textAlign: 'center',
                  marginBottom: 16, cursor: uploading ? 'wait' : 'pointer',
                  transition: 'all 200ms', display: 'block',
                  background: item.video_storage_path ? 'var(--success-bg)' : 'transparent',
                }}>
                  <input
                    type="file"
                    accept="video/mp4,video/mov,video/quicktime,video/*"
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleVideoUpload(f); }}
                  />
                  {uploading ? (
                    <>
                      <div className="spinner" style={{ margin: '0 auto 8px', width: 28, height: 28 }} />
                      <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Enviando vídeo...</p>
                    </>
                  ) : item.video_storage_path ? (
                    <>
                      <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--success)' }}>Vídeo enviado</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Clique para substituir</p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Arraste o vídeo gravado ou clique para selecionar
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>MP4, MOV — Máx. 100MB</p>
                    </>
                  )}
                </label>

                {/* Publish actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={publishing || !item.video_storage_path}
                    onClick={() => {
                      setPublishCaption(script ? `${headline || title}\n\n${cta}`.trim() : '');
                      setShowPublishModal(true);
                    }}
                    title={!item.video_storage_path ? 'Faça o upload do vídeo antes de publicar' : ''}
                  >
                    {publishing ? (
                      <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                    ) : (
                      <Send size={14} />
                    )}
                    Publicar via Instagram
                  </button>
                  <button className="btn btn-secondary" onClick={handleMarkAsPosted}>
                    <CheckCircle size={14} />
                    Marcar como Postado
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar / Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status */}
          <div className="card">
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Status
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['idea_bank', 'modeled', 'in_production', 'posted'] as ContentItem['status'][]).map(s => (
                  <button
                    key={s}
                    onClick={() => handleAdvance(s)}
                    style={{
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${item.status === s ? 'var(--brand-purple)' : 'var(--border-light)'}`,
                      background: item.status === s ? 'var(--info-bg)' : 'transparent',
                      color: item.status === s ? 'var(--brand-purple)' : 'var(--text-secondary)',
                      fontWeight: item.status === s ? 600 : 400,
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 150ms',
                    }}
                  >
                    {item.status === s ? '● ' : '○ '}
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Structured fields */}
          <div className="card">
            <div className="card-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Zap size={14} style={{ color: 'var(--brand-orange)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Campos Estruturados</span>
              </div>

              <div className="input-group">
                <label>Gancho</label>
                <AutoResizeTextarea className="input" value={hook} onChange={e => setHook(e.target.value)} placeholder="Primeiros 3 segundos" />
              </div>

              <div className="input-group">
                <label>Headline</label>
                <AutoResizeTextarea className="input" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Frase principal" />
              </div>

              <div className="input-group">
                <label>CTA</label>
                <AutoResizeTextarea className="input" value={cta} onChange={e => setCta(e.target.value)} placeholder="Chamada para ação" />
              </div>

              <div className="input-group">
                <label>Etapa do Funil</label>
                <select
                  className="select"
                  value={funnelStage}
                  onChange={e => setFunnelStage(e.target.value as FunnelStage)}
                >
                  <option value="top">Topo de funil</option>
                  <option value="middle">Meio de funil</option>
                  <option value="bottom">Fundo de funil</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audience */}
          <div className="card">
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Target size={14} style={{ color: 'var(--brand-pink)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Público-Alvo</span>
              </div>
              <select
                className="select"
                value={audienceId}
                onChange={e => setAudienceId(e.target.value)}
              >
                <option value="">Selecione um público</option>
                {audiences.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.is_default ? '(padrão)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de publicação */}
      {showPublishModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPublishModal(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Publicar no Instagram</h3>
              <button className="btn-icon" onClick={() => setShowPublishModal(false)}>
                <span style={{ fontSize: 18 }}>×</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--info)' }}>
                O vídeo será publicado como <strong>Reels</strong> na sua conta Instagram conectada.
              </div>
              <div className="input-group">
                <label>Legenda do post</label>
                <textarea
                  className="textarea"
                  rows={6}
                  value={publishCaption}
                  onChange={e => setPublishCaption(e.target.value)}
                  placeholder="Escreva a legenda do post (hashtags, emojis, CTA)..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPublishModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handlePublishToInstagram}>
                <Send size={14} />
                Publicar agora
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .page-content > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageLayout>
  );
}
