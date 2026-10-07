import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  Download, FileSpreadsheet, FileText, ShieldCheck, X, Lock,
  AlertTriangle, CheckCircle, MapPin, Table2, Activity, Building2, Stethoscope,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../data/auth';
import { useSavedImports } from '../data/useSavedImports';
import {
  caseCounts, dateRange, diseaseTrends, filterRecords, importedRecords, localToday, summary,
  type AnalysisRecord, type CaseCount, type DatePreset,
} from '../data/analytics';

const COLORS = ['#567CBD', '#5E6C58', '#B77825', '#9F4651', '#547F88', '#745D93', '#2F4156', '#8B7756'];
const TOOLTIP_STYLE = { background: '#FEFCF6', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 };
const DATE_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: 'last7', label: 'Past 7 Days' },
  { value: 'last14', label: 'Last 2 Weeks' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];
const LOCATION_EXAMPLE = [
  { name: 'Luzon', cases: 12 }, { name: 'Visayas', cases: 8 }, { name: 'Mindanao', cases: 5 },
];
const RECORD_PAGE_SIZE = 50;

function ChartCard({ title, hint, populated, children, className = '' }: {
  title: string; hint: string; populated: boolean; children: ReactNode; className?: string;
}) {
  return <section className={`card p-5 min-w-0 ${className}`} aria-label={title}>
    <h2 className="text-base font-semibold text-primary">{title}</h2>
    <p className="text-xs text-text-muted mt-1 mb-4">{hint}</p>
    {populated ? children : <div className="h-64 flex items-center justify-center text-sm text-text-muted text-center">
      No cases in the selected period.
    </div>}
  </section>;
}

function CountBars({ data }: { data: CaseCount[] }) {
  return <div className="max-h-80 overflow-y-auto">
    <div style={{ height: Math.max(256, data.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#D6E0E2" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#F4EFE0' }} />
          <Bar dataKey="cases" name="Cases" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

function AnalysisRecordsTable({ records, stripIds = false }: { records: AnalysisRecord[]; stripIds?: boolean }) {
  return <table className="table-base">
    <thead><tr>
      {[...(stripIds ? [] : ['Case ID']), 'Date Reported', 'Disease', 'Reporting Unit', 'Age Group', 'Sex', 'Classification', 'Imported File'].map((header) => <th key={header} scope="col">{header}</th>)}
    </tr></thead>
    <tbody>
      {records.map((record) => <tr key={record.key}>
        {!stripIds && <td className="font-mono text-xs whitespace-nowrap">{record.caseId || 'Not specified'}</td>}
        <td className="font-mono text-xs whitespace-nowrap">{record.date}</td>
        <td>{record.disease}</td><td>{record.unit}</td><td className="whitespace-nowrap">{record.ageGroup}</td><td>{record.sex}</td>
        <td><span className={record.classification === 'Confirmed' ? 'badge-danger' : record.classification === 'Probable' ? 'badge-warning' : 'badge-info'}>{record.classification}</span></td>
        <td className="text-xs text-text-muted">{record.source}</td>
      </tr>)}
      {records.length === 0 && <tr><td colSpan={stripIds ? 7 : 8} className="py-8 text-center text-text-muted">No records match the selected filters.</td></tr>}
    </tbody>
  </table>;
}

type ExportFormat = 'pdf' | 'xlsx';

export function ExportModal({
  onClose,
  onExport,
  rowCount,
}: {
  onClose: () => void;
  onExport: (f: ExportFormat, stripPii: boolean) => void;
  rowCount: number;
}) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [stripPii, setStripPii] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  const blocked = !stripPii && !acknowledged;

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
      onClick={onClose}
    >
      <div
        className="bg-background-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-storm-200">
          <h3 id="export-title" className="text-lg font-semibold text-primary flex items-center gap-2">
            <Table2 className="w-5 h-5" aria-hidden="true" />
            Export Current View
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-primary/5"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-sm text-text-secondary">
            Exporting <span className="font-semibold text-primary tabular-nums">{rowCount.toLocaleString()}</span>{' '}
            records from the current filtered view.
          </p>

          {/* PII toggle */}
          <div className="rounded-lg border border-storm-200 overflow-hidden">
            <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-primary/5 transition-colors">
              <button
                type="button"
                role="switch"
                aria-checked={stripPii}
                aria-label="Strip Personally Identifiable Information"
                onClick={() => { setStripPii((v) => !v); if (stripPii) setAcknowledged(false); }}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                  stripPii ? 'bg-forest-600' : 'bg-storm-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    stripPii ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  Strip Personally Identifiable Information (PII) / Patient Identifiers
                </span>
                <span className="block text-xs text-text-muted mt-1">
                  Export the filtered records. Case identifiers can be omitted from the exported file.
                </span>
              </span>
            </label>

            {stripPii ? (
              <p className="px-4 pb-3 -mt-1 flex items-start gap-2 text-xs text-status-success">
                <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Case IDs will be omitted. The imported age groups and sex values are retained. Patient names and patient IDs are not included in this view.
                </span>
              </p>
            ) : (
              <div className="px-4 pb-3 -mt-1 space-y-2">
                <p className="flex items-start gap-2 text-xs text-status-danger">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>
                    Identifiable data may be included. This export is prohibited for DOH submission
                    and any external or upper command report.
                  </span>
                </p>
                <label className="flex items-start gap-2 p-2 rounded bg-status-warning/10 border border-status-warning/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-storm-200 text-status-warning focus:ring-status-warning"
                  />
                  <span className="text-xs text-text-primary">
                    I acknowledge this export may contain protected health information and will not
                    transmit it outside the AFP Medical Corps.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Format selector */}
          <fieldset>
            <legend className="text-sm font-medium text-text-primary mb-2">Report format</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'pdf', label: 'PDF Report', hint: 'Print or save as PDF', icon: FileText },
                { id: 'xlsx', label: 'Excel Export', hint: 'Tabular data', icon: FileSpreadsheet },
              ] as const).map(({ id, label, hint, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormat(id)}
                  aria-pressed={format === id}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-colors ${
                    format === id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-storm-200 text-text-secondary hover:border-primary/40'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-text-muted">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <p className="flex items-start gap-2 text-xs text-text-muted">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Exports contain only the records in the selected date range and disease filter.
          </p>
        </div>

        <div className="p-5 border-t border-storm-200 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => onExport(format, stripPii)}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {format === 'pdf' ? 'Print / Save as PDF' : 'Export Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnalysisExportPage() {
  const { canAdministerSurveillance, role } = useAuth();
  const { imports, error } = useSavedImports();
  const [preset, setPreset] = useState<DatePreset>('last7');
  const [today, setToday] = useState(localToday);
  const [custom, setCustom] = useState(() => ({ start: localToday(), end: localToday() }));
  const [disease, setDisease] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [printStripIds, setPrintStripIds] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localToday()), 60_000);
    return () => { window.clearInterval(timer); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const parsed = useMemo(() => importedRecords(imports), [imports]);
  const range = useMemo(() => dateRange(preset, today, custom), [preset, today, custom]);
  const diseaseOptions = useMemo(() => caseCounts(parsed.records, 'disease').map((item) => item.name).sort(), [parsed.records]);
  // Removing the last import for a selected disease restores the all-diseases view.
  const selectedDisease = diseaseOptions.includes(disease) ? disease : '';
  const visible = useMemo(() => filterRecords(parsed.records, range, selectedDisease), [parsed.records, range, selectedDisease]);
  const metrics = useMemo(() => summary(visible), [visible]);
  const diseaseCases = useMemo(() => caseCounts(visible, 'disease'), [visible]);
  const ageCases = useMemo(() => caseCounts(visible, 'ageGroup'), [visible]);
  const sexCases = useMemo(() => caseCounts(visible, 'sex'), [visible]);
  const trend = useMemo(() => diseaseTrends(visible, range), [visible, range]);
  const lastPage = Math.max(0, Math.ceil(visible.length / RECORD_PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * RECORD_PAGE_SIZE;
  const displayed = visible.slice(start, start + RECORD_PAGE_SIZE);

  const handleExport = (format: ExportFormat, stripPii: boolean) => {
    if (!canAdministerSurveillance() || !range || visible.length === 0) return;
    setShowExport(false);
    if (format === 'pdf') {
      setPrintStripIds(stripPii);
      // Allow the modal to unmount before opening the browser's print dialog.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
      return;
    }
    const headers = [...(stripPii ? [] : ['Case_ID']), 'Date_Reported', 'Disease', 'Reporting_Unit', 'Sex', 'Age_Group', 'Case_Classification'];
    const rows = visible.map((record) => [
      ...(stripPii ? [] : [record.caseId]), record.date, record.disease, record.unit,
      record.sex, record.ageGroup, record.classification,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Filtered Records');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Metric', 'Value'], ['Start date', range.start], ['End date', range.end],
      ['Disease filter', selectedDisease || 'All Diseases'], ['Total cases', metrics.total],
      ['Most common disease', metrics.leaders.map((item) => item.name).join(', ')], ['Affected units', metrics.units],
    ]), 'Summary');
    XLSX.writeFile(workbook, `AFP_HSEU_${range.start}_${range.end}.xlsx`);
    setToast(`Exported ${visible.length.toLocaleString()} filtered records to Excel.`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  return (
    <div className="space-y-6 analysis-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Analysis &amp; Export</h1>
          <p className="text-text-secondary mt-1">Cases and trends from your imported surveillance records</p>
        </div>
        <button type="button" onClick={() => setShowExport(true)}
          disabled={!canAdministerSurveillance() || visible.length === 0 || !range}
          title={!canAdministerSurveillance() ? `Export unavailable for ${role.label}` : undefined}
          className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
          data-tour="privacy-export">
          <Download className="w-4 h-4" aria-hidden="true" />Export Current View
        </button>
      </div>

      <section className="card p-5 space-y-4 print:hidden" aria-label="Analysis filters" data-tour="filter-panel">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label htmlFor="analysis-period" className="block text-xs font-semibold text-text-secondary mb-2">Reporting Period</label>
            <select id="analysis-period" value={preset} className="input-base w-full"
              onChange={(event) => { setPreset(event.target.value as DatePreset); setPage(0); }}>
              {DATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label htmlFor="analysis-disease" className="block text-xs font-semibold text-text-secondary mb-2">Disease</label>
            <select id="analysis-disease" value={selectedDisease} className="input-base w-full"
              onChange={(event) => { setDisease(event.target.value); setPage(0); }}>
              <option value="">All Diseases</option>
              {diseaseOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          {preset === 'custom' && <>
            <div className="flex-1 min-w-40">
              <label htmlFor="analysis-start" className="block text-xs font-semibold text-text-secondary mb-2">From</label>
              <input id="analysis-start" type="date" className="input-base w-full" value={custom.start}
                onChange={(event) => { setCustom({ ...custom, start: event.target.value }); setPage(0); }} />
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="analysis-end" className="block text-xs font-semibold text-text-secondary mb-2">To</label>
              <input id="analysis-end" type="date" className="input-base w-full" value={custom.end}
                onChange={(event) => { setCustom({ ...custom, end: event.target.value }); setPage(0); }} />
            </div>
          </>}
          <button type="button" className="btn-secondary" onClick={() => { setPreset('last7'); setDisease(''); setPage(0); }}>Reset Filters</button>
        </div>
        <p className="text-xs text-text-muted">Dates use the record's report date. Past 7 Days and Last 2 Weeks include today; This Month runs through today.</p>
        {!range && <p role="alert" className="text-sm text-status-danger">Enter a valid start and end date, with the start on or before the end.</p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted" aria-live="polite">
        <span>{range ? `${range.start} to ${range.end} (inclusive)` : 'Invalid date range'}{selectedDisease ? ` · ${selectedDisease}` : ' · All diseases'}</span>
        <span>{imports.length} saved import(s) · {parsed.records.length.toLocaleString()} unique dated records</span>
      </div>
      {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
      {(parsed.invalidDates > 0 || parsed.duplicates > 0 || parsed.unsupportedSheets > 0) && <p className="text-xs text-text-muted">
        {parsed.invalidDates > 0 && `${parsed.invalidDates} record(s) with missing or invalid dates excluded. `}
        {parsed.duplicates > 0 && `${parsed.duplicates} repeated case ID(s) counted once using the newest upload. `}
        {parsed.unsupportedSheets > 0 && `${parsed.unsupportedSheets} worksheet(s) without date and disease columns skipped.`}
      </p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="kpi-card flex items-start justify-between gap-3">
          <div><p className="kpi-label">Total Cases</p><p className="kpi-value mt-1">{metrics.total.toLocaleString()}</p><p className="text-xs text-text-muted mt-2">Unique cases in the filtered view</p></div>
          <span className="p-3 rounded-xl bg-primary/10 text-primary"><Activity className="w-5 h-5" aria-hidden="true" /></span>
        </article>
        <article className="kpi-card flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="kpi-label">Most Common Disease</p>
            <p className="text-xl font-bold text-primary mt-2 break-words">{metrics.leaders[0]?.name ?? 'No cases'}{metrics.leaders.length > 1 ? ` (+${metrics.leaders.length - 1} tied)` : ''}</p>
            <p className="text-xs text-text-muted mt-2">{metrics.leaders[0] ? `${metrics.leaders[0].cases.toLocaleString()} cases${metrics.leaders.length > 1 ? ' per tied disease' : ''}` : 'No cases in this period'}</p>
          </div>
          <span className="p-3 rounded-xl bg-forest-600/10 text-forest-600"><Stethoscope className="w-5 h-5" aria-hidden="true" /></span>
        </article>
        <article className="kpi-card flex items-start justify-between gap-3">
          <div><p className="kpi-label">Affected Units</p><p className="kpi-value mt-1">{metrics.units.toLocaleString()}</p><p className="text-xs text-text-muted mt-2">Distinct reporting units with cases</p></div>
          <span className="p-3 rounded-xl bg-accent-teal/10 text-accent-teal"><Building2 className="w-5 h-5" aria-hidden="true" /></span>
        </article>
      </div>

      {visible.length === 0 && range && <div className="card p-5 text-sm text-text-secondary" role="status">
        {parsed.records.length === 0 ? 'Upload a standardized Excel file in Data Management to start viewing case analysis.' : 'No imported cases match these filters. Choose another period or disease.'}
        {parsed.records.length > 0 && <p className="text-xs text-text-muted mt-2">Available report dates: {parsed.records.at(-1)?.date} to {parsed.records[0]?.date}.</p>}
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Cases by Disease" hint="Unique cases for each imported disease" populated={visible.length > 0}>
          <CountBars data={diseaseCases} />
        </ChartCard>
        <ChartCard title="Cases by Age Group" hint="Age groups as reported in the imported records" populated={visible.length > 0}>
          <CountBars data={ageCases} />
        </ChartCard>
        <ChartCard title="Cases by Sex" hint="Sex distribution within the filtered view" populated={visible.length > 0}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sexCases} dataKey="cases" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {sexCases.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs text-text-secondary">
            {sexCases.map((item) => <span key={item.name}>{item.name}: <strong className="text-primary">{item.cases}</strong></span>)}
          </div>
        </ChartCard>
        <ChartCard title="Cases by Location" hint="Sample display only. Location mapping is not connected to imported data or filters." populated className="print:hidden">
          <span className="inline-flex items-center gap-1.5 badge-warning mb-3"><MapPin className="w-3.5 h-3.5" aria-hidden="true" />Placeholder</span>
          <CountBars data={LOCATION_EXAMPLE} />
        </ChartCard>
        <ChartCard title="Disease Trends Over Time" hint={`Cases by report date, grouped by ${trend.interval}. Dates without cases show zero.`} populated={visible.length > 0} className="lg:col-span-2">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.rows} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6E0E2" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={35} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {trend.diseases.map((item, index) => <Line key={item.key} dataKey={item.key} name={item.name}
                  stroke={COLORS[index % COLORS.length]} strokeWidth={2} type="linear" dot={{ r: 3 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <section className="card" aria-labelledby="rec-h">
        <div className="p-5 border-b border-storm-200 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="rec-h" className="text-base font-semibold text-primary">Filtered View Records</h2>
            <p className="text-xs text-text-muted mt-1">The records behind these charts, newest report date first.</p></div>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />Patient names and patient IDs withheld</span>
        </div>
        <div className="table-container border-0 rounded-none print:hidden">
          <AnalysisRecordsTable records={displayed} />
        </div>
        <div className="hidden print:block"><AnalysisRecordsTable records={visible} stripIds={printStripIds} /></div>
        <div className="p-4 border-t border-storm-200 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary print:hidden">
          <span>Showing {visible.length > 0 ? start + 1 : 0}–{Math.min(start + RECORD_PAGE_SIZE, visible.length)} of {visible.length.toLocaleString()} matching records</span>
          {lastPage > 0 && <div className="flex items-center gap-3 print:hidden">
            <button type="button" disabled={currentPage === 0} className="btn-secondary disabled:opacity-50" onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage + 1} of {lastPage + 1}</span>
            <button type="button" disabled={currentPage === lastPage} className="btn-secondary disabled:opacity-50" onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>}
        </div>
      </section>

      {showExport && <ExportModal onClose={() => setShowExport(false)} onExport={handleExport} rowCount={visible.length} />}
      {toast && <div className="fixed bottom-6 right-6 z-50 max-w-sm card p-4 flex items-start gap-3 print:hidden" role="status">
        <CheckCircle className="w-5 h-5 text-status-success" aria-hidden="true" /><p className="text-sm text-text-secondary">{toast}</p>
        <button type="button" onClick={() => setToast(null)} aria-label="Dismiss export message"><X className="w-4 h-4" /></button>
      </div>}
    </div>
  );
}
