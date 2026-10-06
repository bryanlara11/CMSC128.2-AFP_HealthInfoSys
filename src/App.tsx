import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { OnboardingTour, TOUR_STEPS } from './components/OnboardingTour';
import { HomePage } from './pages/HomePage';
import { DataManagementPage } from './pages/DataManagementPage';
import { AnalysisExportPage } from './pages/AnalysisExportPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { AuthProvider, useAuth } from './data/auth';

type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'account-settings';

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const [activeTab, setActiveTab] = useState<ModuleTab>('home');
  const [tourOpen, setTourOpen] = useState(false);
  const { can, canAccessIngestion } = useAuth();

  const startTour = useCallback(() => setTourOpen(true), []);
  const closeTour = useCallback(() => setTourOpen(false), []);

  /* Table 4: the surveillance dashboard is view-only for most roles. */
  const surveillanceVisible = can('surveillance');
  /* Data Management stays visible to all roles; the upload action is gated inside it. */
  const ingestionVisible = canAccessIngestion();

  const tab = (t: ModuleTab) => {
    if (t === 'analysis-export' && !surveillanceVisible) return;
    if (t === 'data-management' && !ingestionVisible) return;
    setActiveTab(t);
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={tab}
        onStartTour={startTour}
        showSidebar={activeTab === 'analysis-export'}
        sidebarProps={{
          onApplyFilters: () => undefined,
          onClearFilters: () => undefined,
          onExport: () => undefined,
          onSaveFilter: () => undefined,
        }}
      >
        {activeTab === 'home' && <HomePage onNavigate={tab} />}
        {activeTab === 'data-management' && ingestionVisible && <DataManagementPage />}
        {activeTab === 'analysis-export' && surveillanceVisible && <AnalysisExportPage />}
        {activeTab === 'account-settings' && <AccountSettingsPage />}
      </Layout>

      {tourOpen && (
        <OnboardingTour activeTab={activeTab} onNavigate={tab} onClose={closeTour} />
      )}
    </>
  );
}

export { TOUR_STEPS };
