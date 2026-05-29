import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageLayout({ title, subtitle, children, actions }: PageLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      <div className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-icon mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: 18 }}>{title}</h1>
              {subtitle && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {actions}
            </div>
          )}
        </div>
        <div className="page-content">
          {children}
        </div>
      </div>

      <style>{`
        .mobile-menu-btn { display: none; }
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex; }
        }
      `}</style>
    </div>
  );
}
