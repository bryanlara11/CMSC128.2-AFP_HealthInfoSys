import { useCallback, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../data/auth';
import { EMPTY_FILTERS, loadAnalytics, exportAnalytics, trendSeries, type AnalyticsFilters } from '../data/analytics';
import { downloadSummary } from '../data/export';
import { useRemote } from '../data/useRemote';

const COLORS = ['#0A3D62', '#4B839F', '#8C5CA6', '#B56826', '#B73D48', '#3C8278', '#64748B', '#91A6B5'];
const tooltipStyle = { background: '#FFFFFF', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 };

export function AnalyticsDashboard({ allowExport = false }: { allowExport?: boolean }) {
  const { role, profile, canAdministerSurveillance } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const load = useCallback(() => loadAnalytics(filters), [filters]);
  const state = useRemote(load);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const data = state.data;
  const series = useMemo(() => data ? trendSeries(data) : { names: [], rows: [] }, [data]);
  const provinces = useMemo(() => {
    if (!data) return [];
    const top = data.byProvince.slice(0, 7);
    if (data.byProvince.length > 7) top.push({ name: 'OTHER PROVINCES', count: data.byProvince.slice(7).reduce((n, row) => n + row.count, 0) });
    return top;
  }, [data]);
  const change = (key: keyof AnalyticsFilters, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setExportMessage(null); setExportError(null); };
  const exportView = async (format: 'csv' | 'xlsx') => {
    if (!canAdministerSurveillance() || state.loading || exporting) return;
    setExporting(true); setExportMessage(null); setExportError(null);
    try {
      const rows = await exportAnalytics(filters, format);
      downloadSummary(rows, format);
      setExportMessage(`Downloaded ${rows.length} aggregate groups. The export was recorded in the audit log.`);
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Could not export this view.'); }
    finally { setExporting(false); }
  };
  return <div className="space-y-6">
    <section className="card p-5 space-y-4" aria-label="Surveillance filters" data-tour="filter-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{role.id === 'it-personnel' ? 'Scope: all assigned units, subject to filters.' : `Scope: ${profile.assignedUnit}`}</p>
        <button type="button" className="btn-secondary" disabled={state.loading} onClick={state.refresh}><RefreshCw className="w-4 h-4" aria-hidden="true" />Refresh analytics</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="text-sm text-text-secondary">Reported from<input aria-label="Reported from" type="date" className="input-base mt-1" value={filters.from} onChange={e => change('from', e.target.value)} /></label>
        <label className="text-sm text-text-secondary">Reported through<input aria-label="Reported through" type="date" className="input-base mt-1" value={filters.to} onChange={e => change('to', e.target.value)} /></label>
        <label className="text-sm text-text-secondary">Disease<select aria-label="Disease" className="input-base mt-1" value={filters.disease} onChange={e => change('disease', e.target.value)}><option value="">All diseases</option>{data?.options.diseases.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="text-sm text-text-secondary">Province<select aria-label="Province" className="input-base mt-1" value={filters.province} onChange={e => change('province', e.target.value)}><option value="">All provinces</option>{data?.options.provinces.map(name => <option key={name}>{name}</option>)}</select></label>
        {role.id === 'it-personnel' && <label className="text-sm text-text-secondary">Assigned unit<select aria-label="Assigned unit" className="input-base mt-1" value={filters.unit} onChange={e => change('unit', e.target.value)}><option value="">All units</option>{data?.options.units.map(name => <option key={name}>{name}</option>)}</select></label>}
      </div>
      <button type="button" className="btn-ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear analytics filters</button>
    </section>
    {state.loading && <p role="status" className="text-sm text-text-muted">Loading current surveillance data...</p>}
    {state.error && <p role="alert" className="card p-4 text-status-danger">{state.error}</p>}
    {data && !state.error && <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Surveillance totals" data-tour="kpi-cards">
        {[
          ['Uploaded records', data.totalRecords], ['Diseases reported', data.distinctDiseases],
          ['Confirmed cases', data.confirmedCases], ['Records with missing values', data.missingValueRecords],
        ].map(([label, count]) => <article key={label} className="kpi-card"><p className="kpi-label">{label}</p><p className="kpi-value" data-testid={label === 'Uploaded records' ? 'record-total' : undefined}>{Number(count).toLocaleString()}</p></article>)}
      </section>
      <p className="text-sm text-text-secondary">Latest reporting date: <strong>{data.latestReportDate ?? 'No dated records'}</strong>. Latest reported week: {data.currentWeekCount} records; preceding week: {data.previousWeekCount}. {data.weeklyChange === null ? 'No preceding-week baseline for a percentage change.' : `Change: ${data.weeklyChange > 0 ? '+' : ''}${data.weeklyChange}%.`}</p>
      <p className="text-xs text-text-muted">Counts represent uploaded rows, not deduplicated patients. Week comparisons use the latest reporting date in the filtered data. Missing or invalid RP DATE values are included in all-time totals and excluded from dated charts and date-range filters ({data.undatedRecords} in the current view).</p>
      {data.totalRecords === 0 ? <section className="card p-8 text-center text-text-secondary">No uploaded records match this view. Upload a standardized workbook or clear the filters.</section> : <>
        <section className="card p-5" aria-labelledby="trend-heading"><h2 id="trend-heading" className="font-semibold text-primary mb-4">Weekly disease trends</h2>
          {series.rows.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={series.rows} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Legend />
            {series.names.map((name, index) => <Line isAnimationActive={false} key={name} type="linear" dataKey={`series_${index}`} name={name} stroke={COLORS[index]} strokeWidth={2} dot={{ r: 2 }} />)}
          </LineChart></ResponsiveContainer></div> : <p className="text-sm text-text-muted">No valid reporting dates are available for a trend chart.</p>}
          <p className="text-xs text-text-muted mt-2">Weeks start Monday. The chart shows up to five diseases with the most records; other diseases remain included in totals.</p>
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="card p-5" aria-labelledby="disease-heading"><h2 id="disease-heading" className="font-semibold text-primary mb-4">Records by disease</h2><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byDisease.slice(0, 10)} layout="vertical" margin={{ left: 15, right: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Bar isAnimationActive={false} dataKey="count" name="Records" fill="#0A3D62" /></BarChart></ResponsiveContainer></div><p className="text-xs text-text-muted">Top ten diseases in the current view.</p></section>
          <section className="card p-5" aria-labelledby="province-heading"><h2 id="province-heading" className="font-semibold text-primary mb-4">Records by province</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={provinces} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90}>{provinces.map((row, index) => <Cell key={row.name} fill={COLORS[index]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div><ul className="space-y-1 text-sm">{provinces.map((row, index) => <li key={row.name} className="flex justify-between gap-3"><span><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: COLORS[index] }} />{row.name}</span><span className="font-mono">{row.count.toLocaleString()}</span></li>)}</ul></section>
        </div>
        <section className="card p-5"><h2 className="font-semibold text-primary mb-3">Records by assigned unit</h2><ul className="divide-y divide-storm-200">{data.byUnit.map(row => <li key={row.name} className="flex justify-between gap-4 py-2 text-sm"><span>{row.name}</span><span className="font-mono">{row.count.toLocaleString()}</span></li>)}</ul></section>
      </>}
      {allowExport && <section className="card p-5 space-y-3" data-tour="privacy-export" aria-label="Aggregate exports">
        <h2 className="font-semibold text-primary">Export current view</h2><p className="text-sm text-text-secondary">Exports group counts by reporting week, disease, province, assigned unit, reporting unit, classification, sex and five-year age band. Names, case IDs, ranks and service identifiers are excluded.</p>
        {canAdministerSurveillance() ? <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={exporting || state.loading} onClick={() => { void exportView('csv'); }}><Download className="w-4 h-4" aria-hidden="true" />Export summary CSV</button><button className="btn-secondary" disabled={exporting || state.loading} onClick={() => { void exportView('xlsx'); }}>Export summary Excel</button></div> : <p className="text-sm text-text-muted">Your role has view-only surveillance access. Export requires full surveillance access.</p>}
        {exporting && <p role="status">Preparing export...</p>}{exportMessage && <p role="status" className="text-sm text-status-success">{exportMessage}</p>}{exportError && <p role="alert" className="text-sm text-status-danger">{exportError}</p>}
      </section>}
    </>}
  </div>;
}
