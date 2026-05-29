import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { ContentItem, ContentMetric } from '../types/database';
import {
  BarChart3, TrendingUp, Eye, Heart,
  Play, Zap, Target, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const COLORS = ['#515BD4', '#8134AF', '#DD2A7B', '#F58529', '#FEDA77', '#2ECC71'];

export function DashboardPage() {
  const { user } = useAuth();
  const [postedItems, setPostedItems] = useState<ContentItem[]>([]);
  const [metrics, setMetrics] = useState<ContentMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [{ data: items }, { data: metricsData }] = await Promise.all([
        supabase
          .from('content_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'posted')
          .order('posted_at', { ascending: false }),
        supabase
          .from('content_metrics')
          .select('*')
          .order('snapshot_at', { ascending: false }),
      ]);

      setPostedItems(items || []);
      setMetrics(metricsData || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  // Calculate KPIs
  const totalPosts = postedItems.length;
  const totalReach = metrics.reduce((sum, m) => sum + (m.reach || 0), 0);
  const avgEngagement = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.likes || 0) + (m.comments || 0) + (m.saves || 0), 0) / metrics.length
    : 0;
  const totalViews = metrics.reduce((sum, m) => sum + (m.video_views || 0), 0);

  // Funnel stage distribution
  const funnelData = [
    { name: 'Topo', value: postedItems.filter(i => i.funnel_stage === 'top').length, color: '#515BD4' },
    { name: 'Meio', value: postedItems.filter(i => i.funnel_stage === 'middle').length, color: '#DD2A7B' },
    { name: 'Fundo', value: postedItems.filter(i => i.funnel_stage === 'bottom').length, color: '#F58529' },
  ].filter(d => d.value > 0);

  // Hook technique performance (from source_analysis)
  const hookData: Record<string, { count: number; totalLikes: number }> = {};
  postedItems.forEach(item => {
    const analysis = item.source_analysis as { hook?: { technique: string } } | null;
    if (analysis?.hook?.technique) {
      const technique = analysis.hook.technique;
      if (!hookData[technique]) hookData[technique] = { count: 0, totalLikes: 0 };
      hookData[technique].count++;
      const itemMetrics = metrics.find(m => m.content_item_id === item.id);
      hookData[technique].totalLikes += itemMetrics?.likes || 0;
    }
  });

  const hookChartData = Object.entries(hookData).map(([technique, data]) => ({
    name: technique,
    avgLikes: data.count > 0 ? Math.round(data.totalLikes / data.count) : 0,
    count: data.count,
  }));

  // Timeline data (last 30 days of posts)
  const timelineData = postedItems
    .filter(i => i.posted_at)
    .slice(0, 30)
    .reverse()
    .map(item => {
      const m = metrics.find(me => me.content_item_id === item.id);
      return {
        date: item.posted_at ? new Date(item.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
        reach: m?.reach || 0,
        likes: m?.likes || 0,
        saves: m?.saves || 0,
      };
    });

  return (
    <PageLayout
      title="Performance"
      subtitle="Métricas e padrões da sua audiência"
    >
      {loading ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <div className="metric-label"><BarChart3 size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Posts Publicados</div>
              <div className="metric-value">{totalPosts}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label"><Eye size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Alcance Total</div>
              <div className="metric-value">{totalReach.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label"><Heart size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Engajamento Médio</div>
              <div className="metric-value">{Math.round(avgEngagement).toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label"><Play size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Views Totais</div>
              <div className="metric-value">{totalViews.toLocaleString()}</div>
            </div>
          </div>

          {totalPosts === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ minHeight: 400 }}>
                <TrendingUp size={48} />
                <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>Sem dados de performance</h3>
                <p style={{ lineHeight: 1.6 }}>
                  Publique conteúdo pelo pipeline para ver métricas e descobrir padrões da sua audiência.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Timeline chart */}
              {timelineData.length > 0 && (
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TrendingUp size={16} style={{ color: 'var(--brand-purple)' }} />
                      <span style={{ fontWeight: 600 }}>Evolução de Métricas</span>
                    </div>
                  </div>
                  <div className="card-body" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey="date" fontSize={11} stroke="var(--text-secondary)" />
                        <YAxis fontSize={11} stroke="var(--text-secondary)" />
                        <Tooltip />
                        <Line type="monotone" dataKey="reach" stroke="#515BD4" name="Alcance" strokeWidth={2} />
                        <Line type="monotone" dataKey="likes" stroke="#DD2A7B" name="Likes" strokeWidth={2} />
                        <Line type="monotone" dataKey="saves" stroke="#F58529" name="Salvamentos" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Funnel distribution */}
              {funnelData.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={16} style={{ color: 'var(--brand-pink)' }} />
                      <span style={{ fontWeight: 600 }}>Distribuição por Funil</span>
                    </div>
                  </div>
                  <div className="card-body" style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={funnelData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {funnelData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Hook technique performance */}
              {hookChartData.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={16} style={{ color: 'var(--brand-orange)' }} />
                      <span style={{ fontWeight: 600 }}>Performance por Gancho</span>
                    </div>
                  </div>
                  <div className="card-body" style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hookChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey="name" fontSize={11} stroke="var(--text-secondary)" />
                        <YAxis fontSize={11} stroke="var(--text-secondary)" />
                        <Tooltip />
                        <Bar dataKey="avgLikes" name="Média de Likes" radius={[4, 4, 0, 0]}>
                          {hookChartData.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Insights */}
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} style={{ color: 'var(--brand-violet)' }} />
                    <span style={{ fontWeight: 600 }}>Insights da Audiência</span>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{
                    padding: 20, background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)', textAlign: 'center',
                  }}>
                    <Sparkles size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Insights automáticos serão gerados conforme você acumula métricas.
                      <br />
                      Ex: "Reels de fundo de funil com gancho de pergunta retêm 40% mais"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
