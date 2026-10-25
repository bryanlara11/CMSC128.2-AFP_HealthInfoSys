import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Header } from './Header';
import { ModuleBar } from './ModuleBar';
import { useAuth } from '../data/auth';

export type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'logs' | 'account-settings';

const BASE_MOBILE_NAV: { id: ModuleTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'data-management', label: 'Data Management' },
  { id: 'analysis-export', label: 'Analysis & Export' },
  // 'logs' is inserted dynamically for admin users
  { id: 'account-settings', label: 'Account Settings' },
];

interface LayoutProps {
  children: React.ReactNode;
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  onStartTour: () => void;
}

export function Layout({
  children,
  activeTab,
  onTabChange,
  onStartTour,
}: LayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { level, can, canAccessIngestion } = useAuth();

  /* Build mobile nav: inject Logs for admin users. */
  const mobileNav = useMemo(() => {
    const isAdmin = ['view', 'full-access'].includes(level('audit'));
    const permitted = BASE_MOBILE_NAV.filter(tab => (tab.id !== 'analysis-export' || can('surveillance')) && (tab.id !== 'data-management' || canAccessIngestion()));
    if (!isAdmin) return permitted;
    const idx = permitted.findIndex(t => t.id === 'account-settings');
    const result = [...permitted];
    result.splice(idx, 0, { id: 'logs' as ModuleTab, label: 'Logs' });
    return result;
  }, [level, can, canAccessIngestion]);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <div className="sticky top-0 z-40">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <ModuleBar activeTab={activeTab} onTabChange={onTabChange} onStartTour={onStartTour} />
      </div>

      <div className="flex flex-1 min-h-0">

        <main id="main-content" role="main" className="flex-1 min-w-0 p-6 lg:p-8">
          {children}
        </main>
      </div>

      <footer className="border-t border-storm-200 bg-background-card">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
            <p>
              &copy; 2026 Armed Forces of the Philippines Medical Corps &mdash; Health Surveillance and
              Epidemiology Unit
            </p>
            <div className="flex items-center gap-4">
              <span>Version 1.0.0</span>
              <span className="text-xs px-2 py-0.5 bg-forest-600/10 text-forest-600 rounded-full">
                DEMO
              </span>
            </div>
          </div>
        </div>
      </footer>

      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/75 z-40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-background-card border-r border-storm-200 md:hidden">
            <div className="flex items-center justify-between p-4 border-b border-storm-200">
              <h2 className="text-lg font-semibold text-primary">Navigation</h2>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-primary/5"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="p-4 space-y-1" role="navigation" aria-label="Mobile">
              {mobileNav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileNavOpen(false);
                  }}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-cream-100'
                      : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
