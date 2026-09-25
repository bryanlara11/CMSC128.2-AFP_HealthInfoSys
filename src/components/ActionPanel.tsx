/**
 * Output surface for the Home page quick actions.
 *
 * Each action opens a panel with real content derived from the pilot dataset
 * rather than a placeholder, so a walkthrough has something to show.
 */

import { useState } from 'react';
import {
  X, FileText, ShieldCheck, Download, Bell, Database, CheckCircle,
  AlertTriangle, Server, FileSpreadsheet, Lock,
} from 'lucide-react';
import { buildWeeklyReport, WEEKLY_REPORT_META, ALERT_RULES, DATA_SOURCES } from '../data/sample';
import { downloadCsv } from '../data/export';
import { RECORDS } from '../data/records';
import { useAuth } from '../data/auth';

/** Declared here rather than in HomePage to keep the dependency one-way. */
export type QuickActionId =
  | 'upload'
  | 'weekly-report'
  | 'trends'
  | 'sources'
  | 'alerts'
  | 'anonymized-export';

const TITLES: Record<QuickActionId, string> = {
  upload: 'Upload Surveillance Data',
  'weekly-report': 'Weekly Epidemiological Report',
  trends: 'Disease Trends',
  sources: 'Data Sources',
  alerts: 'Alert Rules',
  'anonymized-export': 'Anonymized Export',
};

const SEV_STYLE = {
  critical: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
} as const;

const SOURCE_STATUS = {
  healthy: { label: 'Healthy', cls: 'badge-success' },
  degraded: { label: 'Degraded', cls: 'badge-warning' },
  offline: { label: 'Offline', cls: 'bg-storm-200 text-text-muted' },
} as const;

export function ActionPanel({
  id,
  onClose,
  onNavigate,
}: {
  id: QuickActionId;
  onClose: () => void;
  onNavigate?: (tab: 'data-management' | 'analysis-export') => void;
}) {
  const { canUpload, role } = useAuth();
  const [rules, setRules] = useState(ALERT_RULES);
  const [done, setDone] = useState<string | null>(null);

  const flash = (m: string) => {
    setDone(m);
    window.setTimeout(() => setDone(null), 5000);
  };

  const title = TITLES[id];

  return (
    <section className="card p-5" aria-label={title}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            {id === 'alerts' ? <Bell className="w-5 h-5" aria-hidden="true" />
              : id === 'sources' ? <Server className="w-5 h-5" aria-hidden="true" />
              : id === 'anonymized-export' ? <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              : <FileText className="w-5 h-5" aria-hidden="true" />}
            {title}
          </h3>
          {id === 'weekly-report' && (
            <p className="text-xs text-text-muted mt-0.5">
              {WEEKLY_REPORT_META.epiWeek} &middot; {WEEKLY_REPORT_META.period} &middot;{' '}
              {WEEKLY_REPORT_META.audience}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label={`Close ${title}`}>
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {done && (
        <p className="mb-3 flex items-center gap-2 text-sm text-status-success" role="status">
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> {done}
        </p>
      )}

      {/* ---------------- Upload ---------------- */}
      {id === 'upload' && (
        <div className="space-y-4">
          {canUpload() ? (
            <>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{role.label}</span> may upload lab
                batches and surveillance workbooks. Ingestion is validated against the Table 1 schema
                before anything is committed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => onNavigate?.('data-management')} className="btn-primary justify-center">
                  <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                  Open Import Center
                </button>
                <button
                  onClick={() => { onNavigate?.('data-management'); flash('Opened Import Center — run the 30-record error batch from the template card.'); }}
                  className="btn-secondary justify-center"
                >
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Validate Error Batch
                </button>
              </div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>&middot; Accepted formats: .xlsx, .xls, .csv (50 MB max)</li>
                <li>&middot; Rejected on schema drift, bad dates, or duplicate Record IDs</li>
                <li>&middot; Table 5 pilot target: 30&ndash;50 communicable + 20&ndash;30 clearance records</li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-text-secondary flex items-start gap-2">
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              Uploading is restricted. <span className="font-semibold">{role.label}</span> has no
              file-upload rights on system control. Switch to Medical Technologist, Nurse or
              I.T. Personnel in the header to demo ingestion.
            </p>
          )}
        </div>
      )}

      {/* ---------------- Weekly report ---------------- */}
      {id === 'weekly-report' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">{WEEKLY_REPORT_META.totalCases.toLocaleString()}</p>
              <p className="text-[11px] text-text-muted">new cases</p>
            </div>
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">{buildWeeklyReport().length}</p>
              <p className="text-[11px] text-text-muted">conditions</p>
            </div>
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">{RECORDS.length}</p>
              <p className="text-[11px] text-text-muted">records in scope</p>
            </div>
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">{WEEKLY_REPORT_META.categoriesCovered.length}</p>
              <p className="text-[11px] text-text-muted">categories</p>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-storm-200 rounded-lg">
            <table className="w-full text-xs">
              <caption className="sr-only">Weekly cases by condition</caption>
              <thead className="sticky top-0 bg-storm-100">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Condition</th>
                  <th scope="col" className="px-3 py-2 text-left">Surveillance Category</th>
                  <th scope="col" className="px-3 py-2 text-right">New Cases</th>
                  <th scope="col" className="px-3 py-2 text-right">% Change</th>
                  <th scope="col" className="px-3 py-2 text-left">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-storm-200">
                {buildWeeklyReport().map((r) => (
                  <tr key={r.condition}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.condition}</td>
                    <td className="px-3 py-1.5 text-text-muted">{r.category}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.newCases.toLocaleString()}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-mono ${r.percentChange > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                      {r.percentChange > 0 ? '+' : ''}{r.percentChange}%
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-text-secondary">{r.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { downloadCsv(`AFP_HSEU_${WEEKLY_REPORT_META.epiWeek.replace(/\s+/g, '_')}.csv`, RECORDS, true); flash('Aggregate CSV generated with PII stripped.'); }}
              className="btn-primary justify-center"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Generate PDF Summary
            </button>
            <button onClick={() => onNavigate?.('analysis-export')} className="btn-secondary justify-center">
              Open in Analysis &amp; Export
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Matches the 2-page summary form for upper command. Identifiers are stripped by default.
          </p>
        </div>
      )}

      {/* ---------------- Data sources ---------------- */}
      {id === 'sources' && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Local server first, per Q&amp;A #2 — patient data stays on AFP infrastructure. Cloud is
            used only for aggregate external dashboards.
          </p>
          <ul className="divide-y divide-storm-200 border border-storm-200 rounded-lg">
            {DATA_SOURCES.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                <Database className="w-4 h-4 text-text-muted flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm font-medium text-text-primary">{s.name}</p>
                  <p className="text-xs text-text-muted font-mono">{s.kind} &middot; {s.owner} &middot; {s.cadence}</p>
                </div>
                {s.rows > 0 && (
                  <span className="text-xs text-text-secondary tabular-nums">{s.rows.toLocaleString()} rows</span>
                )}
                <span className="text-xs text-text-muted">{s.lastSync}</span>
                <span className={`badge ${SOURCE_STATUS[s.status].cls}`}>{SOURCE_STATUS[s.status].label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------- Alerts ---------------- */}
      {id === 'alerts' && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Rule-based thresholds only — no AI (Q&amp;A #1). Toggle a rule to arm or disarm it.
          </p>
          <ul className="divide-y divide-storm-200 border border-storm-200 rounded-lg">
            {rules.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => setRules((rs) => rs.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)))}
                    className="rounded border-storm-300 flex-shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">{r.name}</span>
                    <span className="block text-xs text-text-muted font-mono truncate">{r.threshold}</span>
                  </span>
                </label>
                <span className={`badge ${SEV_STYLE[r.severity]} flex-shrink-0`}>{r.severity}</span>
                <span className="text-xs text-text-muted tabular-nums flex-shrink-0 w-16 text-right">{r.recipients} rcpt</span>
                <span className="text-xs text-text-muted hidden sm:block w-32 text-right flex-shrink-0">{r.lastTriggered}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">
            {rules.filter((r) => r.enabled).length} of {rules.length} rules armed.
          </p>
        </div>
      )}

      {/* ---------------- Anonymized export ---------------- */}
      {id === 'anonymized-export' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Aggregates only. Patient ID and Names are dropped from the file entirely — not blanked —
            so the export cannot leak them downstream.
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">{RECORDS.length}</p>
              <p className="text-[11px] text-text-muted">rows</p>
            </div>
            <div className="bg-storm-100 rounded-lg py-3">
              <p className="text-xl font-bold tabular-nums text-primary">14</p>
              <p className="text-[11px] text-text-muted">columns kept</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { downloadCsv('AFP_HSEU_Aggregate_Export.csv', RECORDS, true); flash('Anonymized export generated — 2 identifier columns removed.'); }}
              className="btn-primary justify-center"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Export Anonymized CSV
            </button>
            <button onClick={() => onNavigate?.('analysis-export')} className="btn-secondary justify-center">
              Open Export Options
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
