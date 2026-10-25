import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { RecentActivity } from '../components/RecentActivity';
import { useAuth } from '../data/auth';

export function HomePage({ onNavigate }: { onNavigate?: (tab: 'data-management' | 'analysis-export') => void }) {
  const { can, canUpload, canAccessIngestion, profile } = useAuth();
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-primary">Dashboard Overview</h1><p className="text-text-secondary mt-1">Welcome, {profile.fullName} · {profile.assignedUnit}</p></header>
    <div className="flex flex-wrap gap-3">
      {canAccessIngestion() && <button className="btn-primary" onClick={() => onNavigate?.('data-management')}>{canUpload() ? 'Upload surveillance workbook' : 'Open Data Management'}</button>}
      {can('surveillance') && <button className="btn-secondary" onClick={() => onNavigate?.('analysis-export')}>Open Analysis &amp; Export</button>}
    </div>
    {can('surveillance') ? <AnalyticsDashboard /> : <section className="card p-5 text-sm text-text-secondary">Surveillance analytics are unavailable for your role. Use Data Management for the records and upload features your role permits.</section>}
    <RecentActivity />
  </div>;
}
