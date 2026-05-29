import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Pickaxe,
  Search,
  Users,
  Columns3,
  BarChart3,
  Settings,
  LogOut,
  Camera,
  X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { path: '/mine', label: 'Mineração', icon: Search },
  { path: '/audiences', label: 'Público-Alvo', icon: Users },
  { path: '/pipeline', label: 'Pipeline', icon: Columns3 },
  { path: '/dashboard', label: 'Performance', icon: BarChart3 },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ mobileOpen, onCloseMobile, collapsed, onToggleCollapse }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 'calc(var(--z-sidebar) - 1)',
            display: 'none',
          }}
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Pickaxe size={20} color="#fff" />
          </div>
          <span className="sidebar-brand">ContentMiner</span>
          <button
            className="btn-icon"
            onClick={onCloseMobile}
            style={{ marginLeft: 'auto', display: 'none' }}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Instagram connection indicator */}
        <div className="sidebar-status" title={profile?.brand_name || 'Conectar Instagram'}>
          <Camera size={14} style={{ flexShrink: 0 }} />
          <span className="truncate sidebar-label" style={{ flex: 1, fontSize: 12 }}>
            {profile?.brand_name || 'Conectar Instagram'}
          </span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--success)', flexShrink: 0,
          }} />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} style={{ flexShrink: 0 }} />
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div style={{
              width: 32, height: 32,
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="sidebar-label" style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                {profile?.full_name || 'Usuário'}
              </div>
              <div className="truncate" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {profile?.brand_name || 'Minha marca'}
              </div>
            </div>
          </div>
          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ color: 'var(--error)', width: '100%' }}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            <span className="sidebar-label">Sair</span>
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar-status {
          margin: 8px 12px;
          padding: 8px 12px;
          background: var(--bg-surface);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          margin-bottom: 4px;
        }
        /* Collapsed state */
        .sidebar.collapsed { width: var(--sidebar-collapsed); }
        .sidebar.collapsed .sidebar-label { display: none; }
        .sidebar.collapsed .sidebar-brand { display: none; }
        .sidebar.collapsed .sidebar-status { justify-content: center; padding: 8px; }
        .sidebar.collapsed .sidebar-user { justify-content: center; padding: 8px; }
        .sidebar.collapsed .nav-item { justify-content: center; padding: 10px; }
        .sidebar.collapsed .sidebar-header { justify-content: center; gap: 0; }

        .main-content.sidebar-collapsed { margin-left: var(--sidebar-collapsed); }

        @media (max-width: 768px) {
          .sidebar-mobile-overlay { display: block !important; }
          .sidebar .btn-icon[aria-label="Fechar menu"] { display: flex !important; }
        }
      `}</style>
    </>
  );
}
