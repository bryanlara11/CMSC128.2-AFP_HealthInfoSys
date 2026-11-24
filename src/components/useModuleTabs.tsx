import { Home, Database, BarChart3, UserCog, ScrollText } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useAuth } from '../data/auth';

export type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'logs' | 'account-settings';

export interface ModuleTabItem {
  id: ModuleTab;
  label: string;
  icon: ReactNode;
}

type Access = Pick<ReturnType<typeof useAuth>, 'can' | 'level' | 'canAccessIngestion'>;

const MODULES: (ModuleTabItem & { isVisible: (a: Access) => boolean })[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home className="w-4 h-4" aria-hidden="true" />,
    isVisible: () => true,
  },
  {
    id: 'data-management',
    label: 'Data management',
    icon: <Database className="w-4 h-4" aria-hidden="true" />,
    isVisible: (a) => a.canAccessIngestion(),
  },
  {
    id: 'analysis-export',
    label: 'Analysis & export',
    icon: <BarChart3 className="w-4 h-4" aria-hidden="true" />,
    isVisible: (a) => a.can('surveillance'),
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <ScrollText className="w-4 h-4" aria-hidden="true" />,
    isVisible: (a) => ['view', 'full-access'].includes(a.level('audit')),
  },
  {
    id: 'account-settings',
    label: 'Account settings',
    icon: <UserCog className="w-4 h-4" aria-hidden="true" />,
    isVisible: () => true,
  },
];

export function useModuleTabs() {
  const { can, level, canAccessIngestion } = useAuth();

  return useMemo(() => {
    const access: Access = { can, level, canAccessIngestion };
    const tabs: ModuleTabItem[] = MODULES.filter((m) => m.isVisible(access)).map(
      ({ id, label, icon }) => ({ id, label, icon }),
    );
    const allowed = new Set<ModuleTab>(tabs.map((t) => t.id));
    return { tabs, allowed };
  }, [can, level, canAccessIngestion]);
}