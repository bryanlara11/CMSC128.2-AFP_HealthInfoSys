import { useState, useCallback } from 'react';
import { Layout, type ModuleTab } from './components/Layout';
import { useModuleTabs } from './components/useModuleTabs';
import { OnboardingTour, TOUR_STEPS } from './components/OnboardingTour';
import { HomePage } from './pages/HomePage';
import { DataManagementPage } from './pages/DataManagementPage';
import { AnalysisExportPage } from './pages/AnalysisExportPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { LogsPage } from './pages/LogsPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './data/auth';

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

/** Decides whether to show the login screen or the authenticated shell. */
function Root() {
  const { isAuthenticated, isLoading, userId, profile, role } = useAuth();
  if (isLoading) return <main className="min-h-screen flex items-center justify-center bg-background" role="status">Connecting to Supabase...</main>;
  return isAuthenticated ? <Shell key={`${userId}:${profile.assignedUnit}:${role.id}`} /> : <LoginPage />;
}

function Shell() {
  const [activeTab, setActiveTab] = useState<ModuleTab>('home');
  const [tourOpen, setTourOpen] = useState(false);
  const { userId, profile, role, authError } = useAuth();
  /* Which modules this role may see: the same list drives the tabs and this guard. */
  const { allowed } = useModuleTabs();

  const startTour = useCallback(() => setTourOpen(true), []);
  const closeTour = useCallback(() => setTourOpen(false), []);

  const tab = (t: ModuleTab) => {
    if (!allowed.has(t)) return;
    setActiveTab(t);
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={tab}
        onStartTour={startTour}
      >
        {authError && <p role="alert" className="card p-4 mb-4 text-status-danger">{authError}</p>}
        {activeTab === 'home' && <HomePage onNavigate={tab} />}
        {activeTab === 'data-management' && allowed.has('data-management') && <DataManagementPage key={`${userId}:${profile.assignedUnit}:${role.id}`} />}
        {activeTab === 'analysis-export' && allowed.has('analysis-export') && <AnalysisExportPage />}
        {activeTab === 'logs' && allowed.has('logs') && <LogsPage />}
        {activeTab === 'account-settings' && <AccountSettingsPage />}
      </Layout>

      {tourOpen && (
        <OnboardingTour activeTab={activeTab} onNavigate={tab} onClose={closeTour} />
      )}
    </>
  );
}

export { TOUR_STEPS };