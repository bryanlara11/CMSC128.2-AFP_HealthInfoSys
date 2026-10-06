import { useState } from 'react';
import {
  Shield, TrendingUp, FileText, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight,
  Layers, Stethoscope, Activity, Lock, ChevronRight,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DASHBOARD_METRICS } from '../data/dictionary';
import { CONDITIONS_PRESENT } from '../data/records';
import { useAuth } from '../data/auth';
import { ActionPanel, type QuickActionId } from '../components/ActionPanel';

/* Table 3 — Possible Dashboard Results (verbatim metric set from [HI_CMSC] Overview.pdf) */
const kpiData = [
  {
    label: DASHBOARD_METRICS[0].label,
    value: 'Communicable',
    detail: DASHBOARD_METRICS[0].description,
    trend: { value: '+2', label: 'categories reporting', up: true },
    icon: Layers,
    color: 'bg-primary/10 text-primary',
  },
  {
    label: DASHBOARD_METRICS[1].label,
    value: 'Dengue',
    detail: DASHBOARD_METRICS[1].description,
    trend: { value: '4,691', label: 'cases (36.5%)', up: true },
    icon: Stethoscope,
    color: 'bg-forest-600/10 text-forest-600',
  },
  {
    label: DASHBOARD_METRICS[2].label,
    value: '1,284',
    detail: DASHBOARD_METRICS[2].description,
    trend: { value: '8.4%', label: 'vs prior week', up: true },
    icon: Activity,
    color: 'bg-accent-teal/10 text-accent-teal',
  },
  {
    label: DASHBOARD_METRICS[3].label,
    value: '+15.2%',
    detail: DASHBOARD_METRICS[3].description,
    trend: { value: 'vs Epi-Week 36', up: true },
    icon: TrendingUp,
    color: 'bg-status-warning/10 text-status-warning',
  },
];

/* Table 2 conditions only. */
const HOME_TREND = [
  { week: 'W1 Jul', dengue: 180, influenza: 320, leptospirosis: 45 },
  { week: 'W2 Jul', dengue: 210, influenza: 280, leptospirosis: 62 },
  { week: 'W3 Jul', dengue: 265, influenza: 350, leptospirosis: 78 },
  { week: 'W4 Jul', dengue: 310, influenza: 390, leptospirosis: 95 },
  { week: 'W1 Aug', dengue: 295, influenza: 340, leptospirosis: 88 },
  { week: 'W2 Aug', dengue: 355, influenza: 415, leptospirosis: 112 },
  { week: 'W3 Aug', dengue: 402, influenza: 380, leptospirosis: 134 },
  { week: 'W4 Aug', dengue: 448, influenza: 455, leptospirosis: 156 },
  { week: 'W1 Sep', dengue: 512, influenza: 402, leptospirosis: 178 },
  { week: 'W2 Sep', dengue: 587, influenza: 438, leptospirosis: 205 },
  { week: 'W3 Sep', dengue: 634, influenza: 471, leptospirosis: 231 },
  { week: 'W4 Sep', dengue: 691, influenza: 512, leptospirosis: 264 },
];

const recentActivity = [  { time: '09:15 AM', type: 'import', description: 'Dengue surveillance data imported', status: 'success', records: '2,341 records' },
  { time: '08:42 AM', type: 'alert', description: 'Leptospirosis threshold exceeded - Region III', status: 'warning', records: 'Alert sent to 12 recipients' },
  { time: '07:30 AM', type: 'report', description: 'Weekly Epidemiological Report generated', status: 'success', records: 'PDF + Excel exported' },
  { time: '06:45 AM', type: 'sync', description: 'AFP Hospital data synchronized', status: 'success', records: '15 facilities updated' },
  { time: 'Yesterday 05:20 PM', type: 'export', description: 'DOH Monthly Report package prepared', status: 'info', records: 'Anonymized dataset ready' },
];

const quickActions: Array<{ id: QuickActionId; label: string; icon: typeof FileText; primary: boolean }> = [
  { id: 'upload', label: 'Upload Surveillance Data', icon: FileText, primary: true },
  { id: 'weekly-report', label: 'Generate Weekly Report', icon: FileText, primary: false },
  { id: 'trends', label: 'View Disease Trends', icon: TrendingUp, primary: false },
  { id: 'sources', label: 'Manage Data Sources', icon: Shield, primary: false },
  { id: 'alerts', label: 'Configure Alerts', icon: AlertTriangle, primary: false },
  { id: 'anonymized-export', label: 'Export Anonymized Data', icon: Shield, primary: false },
];

export function HomePage({ onNavigate }: { onNavigate?: (tab: 'data-management' | 'analysis-export') => void }) {
  const [panel, setPanel] = useState<QuickActionId | null>(null);
  const { canUpload, canAdministerSurveillance, can, role } = useAuth();
  const TrendIcon = ({ up }: { up: boolean }) => up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />;

  const run = (id: QuickActionId) => {
    /* Two actions cross into another module; the rest open an in-place panel. */
    if (id === 'trends' || id === 'anonymized-export') {
      if (can('surveillance')) onNavigate?.('analysis-export');
      return;
    }
    if (id === 'upload') {
      if (canUpload() && onNavigate) {
        onNavigate('data-management');
        return;
      }
    }
    setPanel((p) => (p === id ? null : id));
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Overview</h1>
          <p className="text-text-secondary mt-1">Health Surveillance & Epidemiology Unit - Real-time monitoring and analysis</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <Clock className="w-4 h-4" aria-hidden="true" />
          <span className="font-mono">Reporting period: Sep 2026</span>
        </div>
      </div>

      {/* KPI Cards */}
      <section aria-labelledby="kpi-heading" className="space-y-4">
        <h2 id="kpi-heading" className="sr-only">Key Performance Indicators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="kpi-cards">
          {kpiData.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <article key={index} className="kpi-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="kpi-label">{kpi.label}</p>
                    <p className={`kpi-value ${kpi.value.length > 6 ? 'text-2xl' : ''}`}>{kpi.value}</p>
                    <p className="text-xs text-text-muted mt-0.5">{kpi.detail}</p>
                    <div className={`kpi-trend ${kpi.trend.up ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
                      <TrendIcon up={kpi.trend.up} aria-hidden="true" />
                      <span>{kpi.trend.value} {kpi.trend.label}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${kpi.color}`}>
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <section className="lg:col-span-1 card p-5 space-y-3">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Shield className="w-5 h-5" aria-hidden="true" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const open = panel === action.id;
              const blocked =
                (action.id === 'upload' && !canUpload()) ||
                ((action.id === 'weekly-report' || action.id === 'anonymized-export' || action.id === 'trends') && !canAdministerSurveillance());
              return (
                <button
                  key={action.id}
                  onClick={() => run(action.id)}
                  aria-expanded={action.id === 'upload' || action.id === 'trends' || action.id === 'anonymized-export' ? undefined : open}
                  title={blocked ? `Unavailable for ${role.label}` : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    action.primary && !blocked
                      ? 'bg-primary text-cream-100 hover:bg-primary-dark'
                      : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                  } ${blocked ? 'opacity-50' : ''}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium flex-1">{action.label}</span>
                  {blocked ? (
                    <Lock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-text-muted pt-1">
            Acting as <span className="font-semibold text-text-secondary">{role.label}</span>. Switch roles
            in the header to see what each role may do.
          </p>
        </section>

        {/* Recent Activity */}
        <section className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Clock className="w-5 h-5" aria-hidden="true" />
              Recent Activity
            </h3>
            <button className="btn-ghost text-sm">View All</button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-primary/5 transition-colors">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.status === 'success' ? 'bg-status-success/10 text-status-success' :
                  activity.status === 'warning' ? 'bg-status-warning/10 text-status-warning' :
                  'bg-accent-teal/10 text-accent-teal'
                }`}>
                  {activity.type === 'import' && <FileText className="w-5 h-5" />}
                  {activity.type === 'alert' && <AlertTriangle className="w-5 h-5" />}
                  {activity.type === 'report' && <FileText className="w-5 h-5" />}
                  {activity.type === 'sync' && <TrendingUp className="w-5 h-5" />}
                  {activity.type === 'export' && <Shield className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-text-muted">{activity.time}</span>
                    <span className={`badge ${activity.status === 'success' ? 'badge-success' : activity.status === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary mt-1">{activity.description}</p>
                  <p className="text-xs text-text-muted mt-1">{activity.records}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quick action output panel */}
      {panel && <ActionPanel id={panel} onClose={() => setPanel(null)} onNavigate={onNavigate} />}

      {/* Disease Trend chart — Table 2 vocabulary */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
            Disease Trends (Last 30 Days)
          </h3>
          <select className="input-base w-auto" aria-label="Filter trend chart by condition" defaultValue="All Conditions">
            {['All Conditions', ...CONDITIONS_PRESENT.slice(0, 6)].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HOME_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D6E0E2" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
              <Tooltip contentStyle={{ background: '#FEFCF6', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="dengue" name="Dengue" stroke="#567CBD" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="influenza" name="Influenza" stroke="#C62828" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="leptospirosis" name="Leptospirosis" stroke="#F57F17" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}