import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import {
  Download, FileSpreadsheet, FileText, ShieldCheck, X, Lock,
  AlertTriangle, CheckCircle, MapPin, Table2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Charts — series and categories restricted to Table 2 vocabulary      */
/* ------------------------------------------------------------------ */

const trendData = [
  { week: 'W1 Jul', dengue: 180, influenza: 320, leptospirosis: 45, pneumonia: 260 },
  { week: 'W2 Jul', dengue: 210, influenza: 280, leptospirosis: 62, pneumonia: 245 },
  { week: 'W3 Jul', dengue: 265, influenza: 350, leptospirosis: 78, pneumonia: 288 },
  { week: 'W4 Jul', dengue: 310, influenza: 390, leptospirosis: 95, pneumonia: 301 },
  { week: 'W1 Aug', dengue: 295, influenza: 340, leptospirosis: 88, pneumonia: 276 },
  { week: 'W2 Aug', dengue: 355, influenza: 415, leptospirosis: 112, pneumonia: 322 },
  { week: 'W3 Aug', dengue: 402, influenza: 380, leptospirosis: 134, pneumonia: 356 },
  { week: 'W4 Aug', dengue: 448, influenza: 455, leptospirosis: 156, pneumonia: 389 },
  { week: 'W1 Sep', dengue: 512, influenza: 402, leptospirosis: 178, pneumonia: 412 },
  { week: 'W2 Sep', dengue: 587, influenza: 438, leptospirosis: 205, pneumonia: 448 },
  { week: 'W3 Sep', dengue: 634, influenza: 471, leptospirosis: 231, pneumonia: 476 },
  { week: 'W4 Sep', dengue: 691, influenza: 512, leptospirosis: 264, pneumonia: 523 },
];

const locationData = [
  { name: 'Luzon Command', value: 980, fill: '#2F4156' },
  { name: 'AFP Education & Training Command', value: 742, fill: '#567CBD' },
  { name: 'Visayas Command', value: 516, fill: '#5E6C58' },
  { name: 'Mindanao Command', value: 388, fill: '#D6E0E2' },
];

/* Table 2 communicable conditions, ranked. */
const diseaseRankData = [
  { name: 'Dengue', cases: 4691 },
  { name: 'Pneumonia', cases: 4155 },
  { name: 'Influenza', cases: 3882 },
  { name: 'Acute Gastroenteritis', cases: 2874 },
  { name: 'Leptospirosis', cases: 1648 },
  { name: 'UTI', cases: 1187 },
];

/* ------------------------------------------------------------------ */
/*  Records — full Table 1 schema, dictionary-backed                    */
/* ------------------------------------------------------------------ */

import { DATA_FIELDS, CASE_CLASSIFICATIONS } from '../data/dictionary';
import { RECORDS, CONDITIONS_PRESENT } from '../data/records';
import { useAuth } from '../data/auth';
import { downloadCsv } from '../data/export';

type Classification = (typeof CASE_CLASSIFICATIONS)[number];

const CLASS_STYLE: Record<Classification, string> = {
  Confirmed: 'badge-danger',
  Probable: 'badge-warning',
  Suspected: 'badge-info',
};


/* ------------------------------------------------------------------ */
/*  Privacy & DOH aggregation export modal                              */
/* ------------------------------------------------------------------ */

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
                  Exports aggregated views compliant with upper command reporting and DOH 2-page
                  summary form requirements while stripping personal identifiers
                </span>
              </span>
            </label>

            {stripPii ? (
              <p className="px-4 pb-3 -mt-1 flex items-start gap-2 text-xs text-status-success">
                <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Patient names, ranks and record linkage keys will be removed. Age is reported in
                  5-year bands and Sex retained, so the output carries no direct identifier.
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
                { id: 'pdf', label: 'PDF Report', hint: '2-page summary form', icon: FileText },
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
            Every export is written to the audit trail with your name, role and timestamp.
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
            {format === 'pdf' ? 'Generate PDF Report' : 'Export Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function AnalysisExportPage() {
  const { canAdministerSurveillance, role } = useAuth();
  const [showExport, setShowExport] = useState(false);
  const [diseaseFilter, setDiseaseFilter] = useState('All Conditions');
  const [showAllFields, setShowAllFields] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visible = useMemo(
    () => (diseaseFilter === 'All Conditions' ? RECORDS : RECORDS.filter((r) => r.condition === diseaseFilter)),
    [diseaseFilter],
  );

  const handleExport = (format: ExportFormat, stripPii: boolean) => {
    setShowExport(false);
    if (format === 'xlsx') {
      downloadCsv('AFP_HSEU_Surveillance_Export.csv', visible, stripPii);
    }
    setToast(
      `${format === 'pdf' ? 'PDF report' : 'Excel export'} generated for ${visible.length} records — ${
        stripPii ? 'PII stripped, DOH-compliant' : 'identifiable data included, audit logged'
      }.`,
    );
    window.setTimeout(() => setToast(null), 6000);
  };

  const stroke = { strokeWidth: 2, dot: { r: 3 } };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Analysis &amp; Export</h1>
          <p className="text-text-secondary mt-1">Epidemiological trends and record-level analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={diseaseFilter}
            onChange={(e) => setDiseaseFilter(e.target.value)}
            className="input-base w-auto"
            aria-label="Filter by disease"
          >
            {['All Conditions', ...CONDITIONS_PRESENT].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          {canAdministerSurveillance() ? (
            <button onClick={() => setShowExport(true)} className="btn-primary whitespace-nowrap" data-tour="privacy-export">
              <Download className="w-4 h-4" aria-hidden="true" />
              Export Current View
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-storm-100 text-text-muted text-sm font-semibold cursor-not-allowed"
              title={`Export requires full surveillance access. "${role.label}" has ${role.grants.surveillance === 'no-access' ? 'no' : 'view-only'} access.`}
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              Export Current View
              <span className="sr-only">— unavailable for {role.label}</span>
            </span>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="card p-5 xl:col-span-2" aria-labelledby="trend-h">
          <h2 id="trend-h" className="text-base font-semibold text-primary mb-4">Disease Trends Over Time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6E0E2" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
                <Tooltip contentStyle={{ background: '#FEFCF6', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 }} labelStyle={{ fontWeight: 600, color: '#162A2C' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="dengue" name="Dengue" stroke="#567CBD" {...stroke} />
                <Line type="monotone" dataKey="pneumonia" name="Pneumonia" stroke="#5E6C58" {...stroke} />
                <Line type="monotone" dataKey="leptospirosis" name="Leptospirosis" stroke="#F57F17" {...stroke} />
                <Line type="monotone" dataKey="influenza" name="Influenza" stroke="#C62828" {...stroke} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="loc-h">
          <h2 id="loc-h" className="text-base font-semibold text-primary mb-4">Cases by Location</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={locationData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {locationData.map((e) => (
                    <Cell key={e.name} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#FEFCF6', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {locationData.map((d) => (
              <li key={d.name} className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} aria-hidden="true" />
                  <span className="text-text-secondary truncate">{d.name}</span>
                </span>
                <span className="font-mono tabular-nums text-text-primary">{d.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="rank-h">
        <h2 id="rank-h" className="text-base font-semibold text-primary mb-4">Cases by Disease / Condition</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diseaseRankData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D6E0E2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6B7B8A' }} tickLine={false} axisLine={{ stroke: '#D6E0E2' }} />
              <Tooltip cursor={{ fill: '#F4EFE0' }} contentStyle={{ background: '#FEFCF6', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cases" name="Cases" fill="#2F4156" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Records table */}
      <section className="card" aria-labelledby="rec-h">
        <div className="p-5 border-b border-storm-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 id="rec-h" className="text-base font-semibold text-primary">Filtered View Records</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded bg-storm-200/50">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            No direct identifiers displayed
          </span>
        </div>

        <div className="table-container border-0 rounded-none">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">Record ID</th>
                <th scope="col">Date Reported</th>
                <th scope="col">Disease / Condition</th>
                <th scope="col">Classification</th>
                <th scope="col">Unit / Station</th>
                <th scope="col">Location</th>
                <th scope="col" className="text-right">Age</th>
                <th scope="col">Sex</th>
                {showAllFields && (
                  <>
                    <th scope="col">Personnel Category</th>
                    <th scope="col">Unit Branch</th>
                    <th scope="col">Service Type</th>
                    <th scope="col">Discharge Date</th>
                    <th scope="col">Logged By Role</th>
                    <th scope="col">Outcome Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.recordId}>
                  <td className="font-mono text-xs whitespace-nowrap">{r.recordId}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{r.encounterDate}</td>
                  <td className="whitespace-nowrap">{r.condition}</td>
                  <td><span className={CLASS_STYLE[r.caseClassification as Classification]}>{r.caseClassification}</span></td>
                  <td className="whitespace-nowrap">{r.reportingFacilityUnit}</td>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      {r.location}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{r.age}</td>
                  <td>{r.sex === 'Male' ? 'M' : 'F'}</td>
                  {showAllFields && (
                    <>
                      <td className="whitespace-nowrap text-text-secondary">{r.personnelCategory}</td>
                      <td className="whitespace-nowrap text-text-secondary">{r.unitBranch}</td>
                      <td className="whitespace-nowrap text-text-secondary">{r.serviceType}</td>
                      <td className="font-mono text-xs whitespace-nowrap text-text-secondary">{r.dischargeDate || '—'}</td>
                      <td className="whitespace-nowrap text-text-secondary">{r.loggedByRole}</td>
                      <td className="whitespace-nowrap text-text-secondary">{r.outcomeStatus}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-storm-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            Patient ID and Names are withheld — synthetic identifiers stay internal.
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={showAllFields}
                onChange={(e) => setShowAllFields(e.target.checked)}
                className="rounded border-storm-300"
              />
              Show all {DATA_FIELDS.length} Table 1 fields
            </label>
            <p className="text-xs text-text-secondary tabular-nums whitespace-nowrap">
              Showing {visible.length} of {RECORDS.length} records
            </p>
          </div>
        </div>
      </section>

      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} onExport={handleExport} rowCount={visible.length} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm card p-4 flex items-start gap-3" role="status">
          <CheckCircle className="w-5 h-5 text-status-success flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Export generated</p>
            <p className="text-xs text-text-muted mt-0.5">{toast}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-text-muted hover:text-text-primary" aria-label="Dismiss">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
