import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { X, Home, Database, BarChart3, UserCog, ScrollText } from 'lucide-react';
import { Header } from './Header';
import { ModuleBar } from './ModuleBar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../data/auth';

export type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'logs' | 'account-settings';

const BASE_MOBILE_NAV: { id: ModuleTab; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" aria-hidden="true" /> },
  { id: 'data-management', label: 'Data management', icon: <Database className="w-4 h-4" aria-hidden="true" /> },
  { id: 'analysis-export', label: 'Analysis & export', icon: <BarChart3 className="w-4 h-4" aria-hidden="true" /> },
  // 'logs' is inserted dynamically for admin users
  { id: 'account-settings', label: 'Account settings', icon: <UserCog className="w-4 h-4" aria-hidden="true" /> },
];

interface LayoutProps {
  children: ReactNode;
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

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Layout({
  children,
  activeTab,
  onTabChange,
  onStartTour,
  showSidebar = false,
  sidebarProps,
}: LayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [entered, setEntered] = useState(false); // drives the slide-in transition
  const { level } = useAuth();

  /* Build mobile nav: inject Logs for admin users. */
  const mobileNav = useMemo(() => {
    const isAdmin = level('audit') === 'full-access';
    if (!isAdmin) return BASE_MOBILE_NAV;
    const idx = BASE_MOBILE_NAV.findIndex(t => t.id === 'account-settings');
    const result = [...BASE_MOBILE_NAV];
    result.splice(idx, 0, {
      id: 'logs' as ModuleTab,
      label: 'Logs',
      icon: <ScrollText className="w-4 h-4" aria-hidden="true" />,
    });
    return result;
  }, [level]);

  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  /* After switching modules: scroll to top and move focus to the content,
     so keyboard and screen-reader users land on the new page, not the old tab. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [activeTab]);

  /* Drawer: slide-in, Escape to close, focus trap, scroll lock, focus restore. */
  useEffect(() => {
    if (!mobileNavOpen) {
      setEntered(false);
      return;
    }

    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    // Two frames so the closed position is painted before the transition starts.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [mobileNavOpen]);

  /* The drawer is hidden from lg up; close it if the window grows so scroll lock doesn't linger. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-cream-100 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <Header onMenuClick={() => setMobileNavOpen(true)} mobileNavOpen={mobileNavOpen} />

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

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 min-w-0 p-6 lg:p-8 focus:outline-none"
        >
          {children}
        </main>
      </div>

      <footer className="border-t border-storm-200 bg-background-card">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 text-sm text-text-muted">
          <p>
            &copy; 2026 Armed Forces of the Philippines Medical Corps &mdash; Health Surveillance and
            Epidemiology Unit
          </p>
          <div className="flex items-center gap-3">
            <span>Version 1.0.0</span>
            <span className="text-xs font-medium px-2 py-0.5 bg-forest-600/10 text-forest-600 rounded-full">
              Demo
            </span>
          </div>
        </div>
      </footer>

      {mobileNavOpen && (
        <div className="lg:hidden">
          <div
            className={`fixed inset-0 z-40 bg-black/50 motion-safe:transition-opacity motion-safe:duration-200 ${
              entered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />

          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-background-card border-r border-storm-200 shadow-2xl motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out ${
              entered ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-storm-200">
              <h2 className="text-lg font-semibold text-primary">Navigation</h2>
              <button
                ref={closeRef}
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="p-3 space-y-1" aria-label="Mobile">
              {mobileNav.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileNavOpen(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}