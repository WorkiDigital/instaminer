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

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { audiences } = useAudiences();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

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
            transcript
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
      setHook(data.hook || '');
      setHeadline(data.headline || '');
      setCta(data.cta || '');
      setFunnelStage((data.funnel_stage as FunnelStage) || 'top');
      setAudienceId(data.target_audience_id || '');
      setLoading(false);
    })();
  }, [id, navigate]);

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
          {/* Source analysis (if from mining) */}
          {analysis && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} style={{ color: 'var(--brand-purple)' }} />
                  <span style={{ fontWeight: 600 }}>Análise de Referência</span>
                </div>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {analysis.hook && (
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
                {analysis.cta && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>CTA</div>
                    <p style={{ fontSize: 13 }}>{analysis.cta.text}</p>
                    <span className="badge badge-success" style={{ marginTop: 4 }}>{analysis.cta.type}</span>
                  </div>
                )}
              </div>
              
              {/* Reference original content */}
              {/* @ts-ignore */}
              {(item.mined_posts?.caption || item.mined_posts?.transcript) && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
                  {/* @ts-ignore */}
                  {item.mined_posts?.caption && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Legenda Original
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {/* @ts-ignore */}
                        {item.mined_posts.caption}
                      </p>
                    </div>
                  )}
                  
                  {/* @ts-ignore */}
                  {item.mined_posts?.transcript && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Transcrição (Roteiro Modelo)
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'var(--bg-body)', padding: 12, borderRadius: 8 }}>
                        {/* @ts-ignore */}
                        {item.mined_posts.transcript}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
              <textarea
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
                <div style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 40, textAlign: 'center',
                  marginBottom: 16, cursor: 'pointer',
                  transition: 'all 200ms',
                }}>
                  <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Arraste o vídeo gravado ou clique para selecionar
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    MP4, MOV — Máx. 100MB
                  </p>
                </div>

                {/* Publish actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled>
                    <Send size={14} />
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
                <input className="input" value={hook} onChange={e => setHook(e.target.value)} placeholder="Primeiros 3 segundos" />
              </div>

              <div className="input-group">
                <label>Headline</label>
                <input className="input" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Frase principal" />
              </div>

              <div className="input-group">
                <label>CTA</label>
                <input className="input" value={cta} onChange={e => setCta(e.target.value)} placeholder="Chamada para ação" />
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
