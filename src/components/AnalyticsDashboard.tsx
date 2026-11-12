import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../data/auth';
import { EMPTY_FILTERS, loadAnalytics, exportAnalytics, trendSeries, type AnalyticsFilters } from '../data/analytics';
import { downloadSummary } from '../data/export';
import { useRemote } from '../data/useRemote';

const COLORS = ['#0A3D62', '#4B839F', '#8C5CA6', '#B56826', '#B73D48', '#3C8278', '#64748B', '#91A6B5'];
const tooltipStyle = { background: '#FFFFFF', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 };

/* ---------- active-filter labels shown under the trend chart title ---------- */

/** '2024-01-30' (from a date input) -> 'Jan 30, 2024'. Change this one function to change the format. */
const formatDate = (iso: string, withYear = true) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

/** "Jan 1 – Jan 30, 2024", "Dec 15, 2023 – Jan 30, 2024", "From Jan 1, 2024", "Up to Jan 30, 2024" or null. */
function dateRangeLabel(f: AnalyticsFilters): string | null {
  if (f.from && f.to) {
    const sameYear = f.from.slice(0, 4) === f.to.slice(0, 4);
    return `${formatDate(f.from, !sameYear)} – ${formatDate(f.to)}`;
  }
  if (f.from) return `From ${formatDate(f.from)}`;
  if (f.to) return `Up to ${formatDate(f.to)}`;
  return null;
}

/* ---------- file names that follow the filters ---------- */

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The filters that are set, as file-name pieces: Cholera, Metro-Manila, 2024-01-01_to_2024-01-30 ... */
function filterNameParts(f: AnalyticsFilters): string[] {
  const parts: string[] = [];
  if (f.disease) parts.push(slug(f.disease));
  if (f.province) parts.push(slug(f.province));
  if (f.unit) parts.push(slug(f.unit));
  if (f.from && f.to) parts.push(`${f.from}_to_${f.to}`);
  else if (f.from) parts.push(`from_${f.from}`);
  else if (f.to) parts.push(`until_${f.to}`);
  return parts.filter(Boolean);
}

/** e.g. AFP_Surveillance_Summary_Cholera_Metro-Manila_2024-01-01_to_2024-01-30.csv (only the filters that are set). */
function exportFileName(f: AnalyticsFilters, format: 'csv' | 'xlsx'): string {
  return `${['AFP_Surveillance_Summary', ...filterNameParts(f)].join('_')}.${format}`;
}

/** e.g. AFP_Surveillance_Weekly-disease-trends_Cholera_2024-01-01_to_2024-01-30.png */
const chartFileName = (chart: string, f: AnalyticsFilters) =>
  `${['AFP_Surveillance', chart, ...filterNameParts(f)].join('_')}.png`;

/* ---------- download a chart as a PNG (title, filters and legend included) ---------- */

interface ChartImage { title: string; subtitle: string; legend?: { name: string; color: string }[]; fileName: string }

async function downloadChartPng(container: HTMLElement | null, { title, subtitle, legend = [], fileName }: ChartImage) {
  // Recharts also draws every legend swatch as a tiny <svg class="recharts-surface">, so take the biggest one: the chart itself.
  const svg = Array.from(container?.querySelectorAll('svg.recharts-surface') ?? [])
    .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
  if (!svg) throw new Error('The chart is not ready yet.');
  const { width, height } = svg.getBoundingClientRect();
  if (width < 100 || height < 100) throw new Error('The chart is not ready yet.');

  // Recharts draws the chart as SVG. The title, filters and legend are HTML, so they are redrawn below.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not render the chart image.'));
      img.src = url;
    });

    const font = 'Arial, Helvetica, sans-serif';
    const scale = 2, pad = 24, innerW = Math.max(width, 480);
    const headerH = subtitle ? 64 : 44;

    // Lay the legend out in rows first, so the canvas can be sized to fit it.
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `13px ${font}`;
    const items = legend.map(item => ({ ...item, w: 14 + measure.measureText(item.name).width + 22 }));
    const rows: (typeof items)[] = [];
    let current: typeof items = [];
    let used = 0;
    for (const item of items) {
      if (used + item.w > innerW && current.length) { rows.push(current); current = []; used = 0; }
      current.push(item);
      used += item.w;
    }
    if (current.length) rows.push(current);
    const legendH = rows.length ? rows.length * 22 + 12 : 0;

    const totalW = innerW + pad * 2;
    const totalH = pad + headerH + height + legendH + pad;
    const canvas = document.createElement('canvas');
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#0A3D62';
    ctx.font = `bold 20px ${font}`;
    ctx.fillText(title, pad, pad, innerW);
    if (subtitle) {
      ctx.fillStyle = '#64748B';
      ctx.font = `13px ${font}`;
      ctx.fillText(subtitle, pad, pad + 28, innerW);
    }

    ctx.drawImage(image, pad, pad + headerH, width, height);

    ctx.font = `13px ${font}`;
    rows.forEach((row, rowIndex) => {
      let x = pad;
      const y = pad + headerH + height + 12 + rowIndex * 22;
      for (const item of row) {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, y + 2, 10, 10);
        ctx.fillStyle = '#334155';
        ctx.fillText(item.name, x + 14, y);
        x += item.w;
      }
    });

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the image file.');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Chart title on the left; active-filter pills and a PNG download button on the right (wraps on narrow cards). */
function ChartHeading({ id, title, range, chips, onDownload }: { id: string; title: string; range: string | null; chips: string[]; onDownload?: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="font-semibold text-primary">{title}</h2>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(range || chips.length > 0) && (
          <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Active filters">
            {range && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {range}
              </span>
            )}
            {chips.map((chip) => (
              <span key={chip} className="rounded-full border border-storm-200 text-text-secondary px-3 py-1 text-xs">{chip}</span>
            ))}
          </div>
        )}
        {onDownload && (
          <button type="button" onClick={onDownload} aria-label={`Download ${title} as PNG`}
            className="inline-flex items-center gap-1.5 rounded-full border border-storm-200 px-3 py-1 text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary/5">
            <Download className="w-3.5 h-3.5" aria-hidden="true" />PNG
          </button>
        )}
      </div>
    </div>
  );
}

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
  const trendRef = useRef<HTMLDivElement>(null);
  const diseaseRef = useRef<HTMLDivElement>(null);
  const provinceRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const saveChart = (ref: RefObject<HTMLDivElement | null>, chart: string, title: string, subset: AnalyticsFilters, legend?: { name: string; color: string }[]) => {
    setChartError(null);
    const subtitle = [dateRangeLabel(subset), subset.disease, subset.province, subset.unit].filter(Boolean).join(' · ');
    downloadChartPng(ref.current, { title, subtitle, legend, fileName: chartFileName(chart, subset) })
      .catch(error => setChartError(error instanceof Error ? error.message : 'Could not download this chart.'));
  };
  const rangeLabel = dateRangeLabel(filters);
  const filterChips = [filters.disease, filters.province, filters.unit].filter(Boolean);
  const change = (key: keyof AnalyticsFilters, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setExportMessage(null); setExportError(null); };
  const exportView = async (format: 'csv' | 'xlsx') => {
    if (!canAdministerSurveillance() || state.loading || exporting) return;
    setExporting(true); setExportMessage(null); setExportError(null);
    try {
      const rows = await exportAnalytics(filters, format);
      const fileName = exportFileName(filters, format);
      downloadSummary(rows, format, fileName);
      setExportMessage(`Downloaded ${rows.length} aggregate groups as ${fileName}. The export was recorded in the audit log.`);
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
    {chartError && <p role="alert" className="text-sm text-status-danger">{chartError}</p>}
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
        <section className="card p-5" aria-labelledby="trend-heading"><ChartHeading id="trend-heading" title="Weekly disease trends" range={rangeLabel} chips={filterChips} onDownload={series.rows.length ? () => saveChart(trendRef, 'Weekly-disease-trends', 'Weekly disease trends', filters, series.names.map((name, index) => ({ name, color: COLORS[index] }))) : undefined} />
          {series.rows.length ? <div ref={trendRef} className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={series.rows} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Legend />
            {series.names.map((name, index) => <Line isAnimationActive={false} key={name} type="linear" dataKey={`series_${index}`} name={name} stroke={COLORS[index]} strokeWidth={2} dot={{ r: 2 }} />)}
          </LineChart></ResponsiveContainer></div> : <p className="text-sm text-text-muted">No valid reporting dates are available for a trend chart.</p>}
          <p className="text-xs text-text-muted mt-2">Weeks start Monday. The chart shows up to five diseases with the most records; other diseases remain included in totals.</p>
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="card p-5" aria-labelledby="disease-heading"><ChartHeading id="disease-heading" title="Records by disease" range={null} chips={filters.disease ? [filters.disease] : []} onDownload={() => saveChart(diseaseRef, 'Records-by-disease', 'Records by disease', { ...EMPTY_FILTERS, disease: filters.disease })} /><div ref={diseaseRef} className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byDisease.slice(0, 10)} layout="vertical" margin={{ left: 15, right: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Bar isAnimationActive={false} dataKey="count" name="Records" fill="#0A3D62" /></BarChart></ResponsiveContainer></div><p className="text-xs text-text-muted">Top ten diseases in the current view.</p></section>
          <section className="card p-5" aria-labelledby="province-heading"><ChartHeading id="province-heading" title="Records by province" range={null} chips={filters.province ? [filters.province] : []} onDownload={() => saveChart(provinceRef, 'Records-by-province', 'Records by province', { ...EMPTY_FILTERS, province: filters.province }, provinces.map((row, index) => ({ name: `${row.name} (${row.count.toLocaleString()})`, color: COLORS[index] })))} /><div ref={provinceRef} className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={provinces} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90}>{provinces.map((row, index) => <Cell key={row.name} fill={COLORS[index]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div><ul className="space-y-1 text-sm">{provinces.map((row, index) => <li key={row.name} className="flex justify-between gap-3"><span><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: COLORS[index] }} />{row.name}</span><span className="font-mono">{row.count.toLocaleString()}</span></li>)}</ul></section>
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