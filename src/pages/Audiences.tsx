import { useState, useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { useAudiences } from '../hooks/useAudiences';
import { supabase } from '../lib/supabase';
import type { AwarenessLevel } from '../types/database';
import {
  Plus, Users, Edit2, Trash2, Star, X, Save, AlertCircle, Copy,
} from 'lucide-react';

const awarenessOptions: { value: AwarenessLevel; label: string; desc: string }[] = [
  { value: 'inconsciente', label: 'Inconsciente', desc: 'Não sabe que tem o problema' },
  { value: 'consciente_problema', label: 'Consciente do Problema', desc: 'Sabe que tem o problema mas não conhece soluções' },
  { value: 'consciente_solucao', label: 'Consciente da Solução', desc: 'Conhece soluções mas não o seu produto' },
  { value: 'consciente_produto', label: 'Consciente do Produto', desc: 'Conhece seu produto e está avaliando' },
];

interface FormData {
  name: string;
  pain_points: string;
  desires: string;
  awareness_level: AwarenessLevel;
  objections: string;
  language_tone: string;
  is_default: boolean;
}

const emptyForm: FormData = {
  name: '',
  pain_points: '',
  desires: '',
  awareness_level: 'consciente_problema',
  objections: '',
  language_tone: '',
  is_default: false,
};

export function AudiencesPage() {
  const { audiences, loading, createAudience, updateAudience, deleteAudience } = useAudiences();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // Busca contagem de conteúdos por público
  useEffect(() => {
    if (audiences.length === 0) return;
    const ids = audiences.map(a => a.id);
    supabase
      .from('content_items')
      .select('target_audience_id')
      .in('target_audience_id', ids)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        for (const row of data || []) {
          if (row.target_audience_id) {
            counts[row.target_audience_id] = (counts[row.target_audience_id] || 0) + 1;
          }
        }
        setUsageCounts(counts);
      });
  }, [audiences]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (audience: typeof audiences[0]) => {
    setEditingId(audience.id);
    setForm({
      name: audience.name,
      pain_points: audience.pain_points || '',
      desires: audience.desires || '',
      awareness_level: (audience.awareness_level as AwarenessLevel) || 'consciente_problema',
      objections: audience.objections || '',
      language_tone: audience.language_tone || '',
      is_default: audience.is_default,
    });
    setShowForm(true);
  };

  const openDuplicate = (audience: typeof audiences[0]) => {
    setEditingId(null);
    setForm({
      name: `Cópia de ${audience.name}`,
      pain_points: audience.pain_points || '',
      desires: audience.desires || '',
      awareness_level: (audience.awareness_level as AwarenessLevel) || 'consciente_problema',
      objections: audience.objections || '',
      language_tone: audience.language_tone || '',
      is_default: false,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    if (editingId) {
      await updateAudience(editingId, form);
    } else {
      await createAudience(form);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este público-alvo?')) {
      await deleteAudience(id);
    }
  };

  return (
    <PageLayout
      title="Público-Alvo"
      subtitle="Configure os perfis de público que serão usados na geração de roteiros"
      actions={
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} />
          Novo Público
        </button>
      }
    >
      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar' : 'Novo'} Público-Alvo</h3>
              <button className="btn-icon" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Nome do público *</label>
                  <input
                    className="input"
                    placeholder='Ex: "Donos de loja de móveis"'
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Dores principais</label>
                  <textarea
                    className="textarea"
                    placeholder="Quais são as maiores dores e frustrações desse público?"
                    value={form.pain_points}
                    onChange={e => setForm({ ...form, pain_points: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="input-group">
                  <label>Desejos / Transformação buscada</label>
                  <textarea
                    className="textarea"
                    placeholder="O que esse público quer alcançar? Qual a transformação desejada?"
                    value={form.desires}
                    onChange={e => setForm({ ...form, desires: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="input-group">
                  <label>Nível de consciência</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {awarenessOptions.map(opt => (
                      <label
                        key={opt.value}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: 10, borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.awareness_level === opt.value ? 'var(--brand-purple)' : 'var(--border)'}`,
                          background: form.awareness_level === opt.value ? 'var(--info-bg)' : 'var(--bg-base)',
                          cursor: 'pointer', transition: 'all 150ms ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="awareness"
                          value={opt.value}
                          checked={form.awareness_level === opt.value}
                          onChange={() => setForm({ ...form, awareness_level: opt.value })}
                          style={{ accentColor: 'var(--brand-purple)', marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label>Objeções comuns</label>
                  <textarea
                    className="textarea"
                    placeholder="Quais objeções esse público levanta antes de comprar/agir?"
                    value={form.objections}
                    onChange={e => setForm({ ...form, objections: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="input-group">
                  <label>Tom de voz / Vocabulário</label>
                  <textarea
                    className="textarea"
                    placeholder='Ex: "Informal, direto, usa gírias do mercado imobiliário"'
                    value={form.language_tone}
                    onChange={e => setForm({ ...form, language_tone: e.target.value })}
                    rows={2}
                  />
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={e => setForm({ ...form, is_default: e.target.checked })}
                    style={{ accentColor: 'var(--brand-purple)', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Público padrão</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Será pré-selecionado na geração de roteiros
                    </div>
                  </div>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                  {saving ? (
                    <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />
                  ) : (
                    <>
                      <Save size={14} />
                      {editingId ? 'Salvar' : 'Criar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audiences list */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : audiences.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ minHeight: 400 }}>
            <Users size={48} />
            <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>Nenhum público-alvo configurado</h3>
            <p style={{ lineHeight: 1.6, maxWidth: 400 }}>
              Configure pelo menos um público-alvo para que a IA possa gerar roteiros adaptados à sua audiência.
            </p>
            <button className="btn btn-primary" onClick={openNew} style={{ marginTop: 16 }}>
              <Plus size={16} />
              Criar primeiro público
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {audiences.map(audience => (
            <div key={audience.id} className="card animate-slide-up">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{audience.name}</span>
                  {audience.is_default && (
                    <span className="badge badge-warning" style={{ gap: 3 }}>
                      <Star size={10} /> Padrão
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {usageCounts[audience.id] ? (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>
                      {usageCounts[audience.id]} conteúdo{usageCounts[audience.id] > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  <button className="btn-icon" onClick={() => openDuplicate(audience)} title="Duplicar">
                    <Copy size={15} />
                  </button>
                  <button className="btn-icon" onClick={() => openEdit(audience)} title="Editar">
                    <Edit2 size={15} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleDelete(audience.id)}
                    title="Excluir"
                    style={{ color: 'var(--error)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                {audience.awareness_level && (
                  <div style={{ marginBottom: 12 }}>
                    <span className="badge badge-info">
                      {awarenessOptions.find(o => o.value === audience.awareness_level)?.label || audience.awareness_level}
                    </span>
                  </div>
                )}

                {audience.pain_points && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
                      Dores
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {audience.pain_points.slice(0, 120)}{audience.pain_points.length > 120 ? '...' : ''}
                    </p>
                  </div>
                )}

                {audience.desires && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
                      Desejos
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {audience.desires.slice(0, 120)}{audience.desires.length > 120 ? '...' : ''}
                    </p>
                  </div>
                )}

                {audience.language_tone && (
                  <div style={{
                    marginTop: 10, padding: '6px 10px',
                    background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    🗣️ {audience.language_tone.slice(0, 80)}
                  </div>
                )}

                {(!audience.pain_points || !audience.desires || !audience.language_tone) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      {'Preencha '}
                      {[
                        !audience.pain_points && 'dores',
                        !audience.desires && 'desejos',
                        !audience.language_tone && 'tom de voz',
                      ].filter(Boolean).join(', ')}
                      {' para roteiros mais precisos'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
