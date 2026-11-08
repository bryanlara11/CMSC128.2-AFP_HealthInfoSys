import { Home, Database, BarChart3, UserCog, ScrollText } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { TourTrigger } from './OnboardingTour';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '../data/auth';
import type { ModuleTab } from './Layout';

interface ModuleBarProps {
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  onStartTour: () => void;
}

const BASE_TABS: { id: ModuleTab; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" aria-hidden="true" /> },
  { id: 'data-management', label: 'Data management', icon: <Database className="w-4 h-4" aria-hidden="true" /> },
  { id: 'analysis-export', label: 'Analysis & export', icon: <BarChart3 className="w-4 h-4" aria-hidden="true" /> },
  // 'logs' is inserted for admin users (same rule as the mobile drawer in Layout)
  { id: 'account-settings', label: 'Account settings', icon: <UserCog className="w-4 h-4" aria-hidden="true" /> },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * Floating bar that overlaps the bottom of the Header banner and stays pinned
 * near the top of the screen while the page scrolls.
 * lg and up: full-width bar with the module tabs.
 * Below lg: a small pill with just the tour button and search (tabs live in the drawer).
 */
export function ModuleBar({ activeTab, onTabChange, onStartTour }: ModuleBarProps) {
  const { level } = useAuth();

  const tabs = useMemo(() => {
    if (level('audit') !== 'full-access') return BASE_TABS;
    const idx = BASE_TABS.findIndex((t) => t.id === 'account-settings');
    const result = [...BASE_TABS];
    result.splice(idx, 0, {
      id: 'logs',
      label: 'Logs',
      icon: <ScrollText className="w-4 h-4" aria-hidden="true" />,
    });
    return result;
  }, [level]);

  return (
    <div className="sticky top-3 z-40 -mt-7 mb-2 mr-2 md:mr-3 lg:mr-4 ml-auto lg:ml-4 w-fit lg:w-auto">
      <div className="h-14 flex items-center gap-2 px-2 md:px-3 lg:px-4 rounded-2xl bg-background-card border border-storm-200 shadow-lg shadow-black/15">
        <nav
          aria-label="Main modules"
          data-tour="module-nav"
          className="hidden lg:flex items-center gap-1"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                aria-controls={`panel-${tab.id}`}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${FOCUS_RING} ${
                  active
                    ? 'bg-primary text-cream-100'
                    : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="lg:ml-auto flex items-center gap-1.5 md:gap-2">
          <TourTrigger onStart={onStartTour} />
          <GlobalSearch />
        </div>
      </div>
    </div>
  );
}