import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { OnboardingTour, TOUR_STEPS } from './components/OnboardingTour';
import { HomePage } from './pages/HomePage';
import { DataManagementPage } from './pages/DataManagementPage';
import { AnalysisExportPage } from './pages/AnalysisExportPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { LogsPage } from './pages/LogsPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './data/auth';

type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'logs' | 'account-settings';

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
  const { can, canAccessIngestion, level, userId, profile, role, authError } = useAuth();

  const startTour = useCallback(() => setTourOpen(true), []);
  const closeTour = useCallback(() => setTourOpen(false), []);

  /* Table 4: the surveillance dashboard is view-only for most roles. */
  const surveillanceVisible = can('surveillance');
  /* Data Management includes permitted import operations and demographic record editing. */
  const ingestionVisible = canAccessIngestion();
  /* Medical Officers can view their unit's logs; I.T. can view all units. */
  const logsVisible = ['view', 'full-access'].includes(level('audit'));

  const tab = (t: ModuleTab) => {
    if (t === 'analysis-export' && !surveillanceVisible) return;
    if (t === 'data-management' && !ingestionVisible) return;
    if (t === 'logs' && !logsVisible) return;
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
        {activeTab === 'data-management' && ingestionVisible && <DataManagementPage key={`${userId}:${profile.assignedUnit}:${role.id}`} />}
        {activeTab === 'analysis-export' && surveillanceVisible && <AnalysisExportPage />}
        {activeTab === 'logs' && logsVisible && <LogsPage />}
        {activeTab === 'account-settings' && <AccountSettingsPage />}
      </Layout>

      {tourOpen && (
        <OnboardingTour activeTab={activeTab} onNavigate={tab} onClose={closeTour} />
      )}
    </>
  );
}

export { TOUR_STEPS };
