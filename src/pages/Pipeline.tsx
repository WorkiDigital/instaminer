import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { usePipeline } from '../hooks/usePipeline';
import type { ContentStatus, FunnelStage, ContentItem } from '../types/database';
import {
  Lightbulb, Sparkles, Video, Send, GripVertical, Plus,
  ArrowRight, Trash2, ExternalLink,
} from 'lucide-react';

const columnConfig: Record<ContentStatus, {
  title: string;
  icon: React.ReactNode;
  color: string;
}> = {
  idea_bank: {
    title: 'Banco de Ideias',
    icon: <Lightbulb size={14} />,
    color: 'var(--brand-purple)',
  },
  modeled: {
    title: 'Conteúdo Modelado',
    icon: <Sparkles size={14} />,
    color: 'var(--brand-violet)',
  },
  in_production: {
    title: 'Em Produção',
    icon: <Video size={14} />,
    color: 'var(--brand-pink)',
  },
  posted: {
    title: 'Postado',
    icon: <Send size={14} />,
    color: 'var(--success)',
  },
};

const funnelBadge: Record<FunnelStage, { label: string; className: string }> = {
  top: { label: 'Topo', className: 'badge-funnel-top' },
  middle: { label: 'Meio', className: 'badge-funnel-middle' },
  bottom: { label: 'Fundo', className: 'badge-funnel-bottom' },
};

const statusOrder: ContentStatus[] = ['idea_bank', 'modeled', 'in_production', 'posted'];

export function PipelinePage() {
  const navigate = useNavigate();
  const { columns, loading, moveItem, deleteItem } = usePipeline();

  const getNextStatus = (current: ContentStatus): ContentStatus | null => {
    const idx = statusOrder.indexOf(current);
    return idx < statusOrder.length - 1 ? statusOrder[idx + 1] : null;
  };

  const handleAdvance = async (item: ContentItem) => {
    const next = getNextStatus(item.status);
    if (next) {
      await moveItem(item.id, next);
    }
  };

  const renderCard = (item: ContentItem) => {
    return (
      <div
        key={item.id}
        className="kanban-card animate-fade-in"
        onClick={() => navigate(`/content/${item.id}`)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <GripVertical size={14} style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {item.title || 'Sem título'}
            </div>

            {/* Funnel badge */}
            {item.funnel_stage && (
              <span className={`badge ${funnelBadge[item.funnel_stage]?.className || ''}`} style={{ marginBottom: 6 }}>
                {funnelBadge[item.funnel_stage]?.label || item.funnel_stage}
              </span>
            )}

            {/* Hook preview */}
            {item.hook && (
              <p style={{
                fontSize: 11, color: 'var(--text-secondary)',
                marginTop: 6, lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                🪝 {item.hook}
              </p>
            )}

            {/* Progress indicators */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 11 }}>
              <span style={{ color: item.generated_script ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {item.generated_script ? '✓' : '○'} Roteiro
              </span>
              <span style={{ color: item.video_storage_path ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {item.video_storage_path ? '✓' : '○'} Vídeo
              </span>
              <span style={{ color: item.ig_media_id ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {item.ig_media_id ? '✓' : '○'} Publicado
              </span>
            </div>

            {/* Se postado: data + link */}
            {item.status === 'posted' && item.posted_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>📅 {new Date(item.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                {item.posted_permalink && (
                  <a
                    href={item.posted_permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--brand-purple)', display: 'flex', alignItems: 'center', gap: 2 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={10} />
                    Ver post
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{
          display: 'flex', gap: 4, marginTop: 10,
          paddingTop: 8, borderTop: '1px solid var(--border-light)',
        }}
          onClick={e => e.stopPropagation()}
        >
          {getNextStatus(item.status) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleAdvance(item)}
              style={{ flex: 1, fontSize: 11 }}
            >
              <ArrowRight size={12} />
              Avançar
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => { if (confirm('Excluir este card?')) deleteItem(item.id); }}
            style={{ color: 'var(--error)', width: 28, height: 28 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <PageLayout
      title="Pipeline"
      subtitle="Gerencie o fluxo de produção do seu conteúdo"
      actions={
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/mine')}
        >
          <Plus size={14} />
          Minerar Conteúdo
        </button>
      }
    >
      {loading ? (
        <div className="kanban-board">
          {statusOrder.map(status => (
            <div key={status} className="kanban-column">
              <div className="skeleton" style={{ height: 24, marginBottom: 16, width: '70%' }} />
              {[1, 2].map(i => (
                <div key={i} className="skeleton" style={{ height: 120, marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="kanban-board">
          {statusOrder.map(status => {
            const config = columnConfig[status];
            const colItems = columns[status] || [];

            return (
              <div key={status} className="kanban-column">
                <div className="kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 4, height: 16, borderRadius: 2,
                      background: config.color,
                    }} />
                    <span className="kanban-column-title">{config.title}</span>
                  </div>
                  <span className="kanban-count">{colItems.length}</span>
                </div>

                <div className="kanban-cards">
                  {colItems.length === 0 ? (
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 8, opacity: 0.5, padding: 20,
                    }}>
                      {config.icon}
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Nenhum item
                      </span>
                    </div>
                  ) : (
                    colItems.map(renderCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
