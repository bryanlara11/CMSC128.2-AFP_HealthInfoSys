import { useState } from 'react';
import { X } from 'lucide-react';
import { Header } from './Header';
import { ModuleBar } from './ModuleBar';
import { Sidebar } from './Sidebar';

export type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'account-settings';

const MOBILE_NAV: { id: ModuleTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'data-management', label: 'Data Management' },
  { id: 'analysis-export', label: 'Analysis & Export' },
  { id: 'account-settings', label: 'Account Settings' },
];

interface LayoutProps {
  children: React.ReactNode;
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  onStartTour: () => void;
  showSidebar?: boolean;
  sidebarProps?: {
    onApplyFilters: () => void;
    onClearFilters: () => void;
    onExport: () => void;
    onSaveFilter: () => void;
  };
}

export function Layout({
  children,
  activeTab,
  onTabChange,
  onStartTour,
  showSidebar = false,
  sidebarProps,
}: LayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <Header onMenuClick={() => setMobileNavOpen(true)} />

      <ModuleBar activeTab={activeTab} onTabChange={onTabChange} onStartTour={onStartTour} />

      <div className="flex flex-1 min-h-0">
        {showSidebar && (
          <Sidebar
            onApplyFilters={sidebarProps?.onApplyFilters ?? (() => undefined)}
            onClearFilters={sidebarProps?.onClearFilters ?? (() => undefined)}
            onExport={sidebarProps?.onExport ?? (() => undefined)}
            onSaveFilter={sidebarProps?.onSaveFilter ?? (() => undefined)}
          />
        )}

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
              {MOBILE_NAV.map((item) => (
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
