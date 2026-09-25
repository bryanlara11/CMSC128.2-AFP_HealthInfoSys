/**
 * Sample operational data backing the Home page quick actions.
 *
 * All synthetic and consistent with Table 2 vocabulary, so anything generated
 * from here (weekly report, alert digest, export) matches the records dataset.
 */

import { RECORDS } from './records';
import { SURVEILLANCE_CATEGORIES, categoryFor } from './dictionary';

/* ---------------- Weekly epidemiological report ---------------- */

export interface ReportRow {
  condition: string;
  category: string;
  newCases: number;
  percentChange: number;
  outcome: string;
}

export function buildWeeklyReport(): ReportRow[] {
  /* Count real records per condition, then add a deterministic offset so the
     weekly figures read like an epi-week rather than a flat sample of 100. */
  const counts = new Map<string, number>();
  for (const r of RECORDS) counts.set(r.condition, (counts.get(r.condition) ?? 0) + 1);

  return Array.from(counts.entries())
    .map(([condition, n], i) => {
      const newCases = n * 37 + ((i * 53) % 41);
      const percentChange = ((i * 7) % 29) - 11;
      return {
        condition,
        category: categoryFor(condition)?.label ?? 'Communicable / Infectious Diseases',
        newCases,
        percentChange,
        outcome: percentChange > 0 ? 'Rising — review' : 'Stable',
      };
    })
    .sort((a, b) => b.newCases - a.newCases);
}

export const WEEKLY_REPORT_META = {
  title: 'Weekly Epidemiological Summary',
  epiWeek: 'Epi-Week 38',
  period: '14–20 Sep 2026',
  audience: 'Upper command — 2-page DOH summary form',
  totalCases: buildWeeklyReport().reduce((n, r) => n + r.newCases, 0),
  categoriesCovered: SURVEILLANCE_CATEGORIES.filter((c) => c.inPilotScope).map((c) => c.label),
};

/* ---------------- Alert rules ---------------- */

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  recipients: number;
  lastTriggered: string;
}

export const ALERT_RULES: AlertRule[] = [
  {
    id: 'dengue-threshold',
    name: 'Dengue weekly threshold',
    condition: 'Dengue',
    threshold: '> 600 new cases in one Epi-Week',
    severity: 'critical',
    enabled: true,
    recipients: 12,
    lastTriggered: '20 Sep 2026, 08:42',
  },
  {
    id: 'lepto-cluster',
    name: 'Leptospirosis cluster',
    condition: 'Leptospirosis',
    threshold: '>= 3 cases from one reporting unit',
    severity: 'critical',
    enabled: true,
    recipients: 8,
    lastTriggered: '18 Sep 2026, 14:10',
  },
  {
    id: 'pct-change',
    name: 'Rapid percent-change watch',
    condition: 'Any Table 2 condition',
    threshold: 'Week-over-week change > +15%',
    severity: 'warning',
    enabled: true,
    recipients: 12,
    lastTriggered: '19 Sep 2026, 09:00',
  },
  {
    id: 'ingestion-fail',
    name: 'Ingestion failure',
    condition: 'Any uploaded workbook',
    threshold: '>= 1 row rejected by the validator',
    severity: 'warning',
    enabled: true,
    recipients: 4,
    lastTriggered: '17 Sep 2026, 16:35',
  },
  {
    id: 'outcomes',
    name: 'Admitted / expired outcome',
    condition: 'Outcome Status',
    threshold: 'Any record not Recovered',
    severity: 'info',
    enabled: false,
    recipients: 6,
    lastTriggered: 'Never',
  },
];

/* ---------------- Data sources ---------------- */

export interface DataSource {
  id: string;
  name: string;
  kind: string;
  owner: string;
  cadence: string;
  lastSync: string;
  status: 'healthy' | 'degraded' | 'offline';
  rows: number;
}

export const DATA_SOURCES: DataSource[] = [
  { id: 'hseu-ward', name: 'HSEU Ward Register', kind: 'Local server (PostgreSQL)', owner: 'HSEU', cadence: 'Daily 22:00', lastSync: '24 Sep, 22:04', status: 'healthy', rows: 4820 },
  { id: 'afp-hospitals', name: 'AFP Medical Corps Hospitals', kind: 'Local server (PostgreSQL)', owner: 'AFPMC', cadence: 'Daily 22:00', lastSync: '24 Sep, 21:58', status: 'healthy', rows: 12406 },
  { id: 'unit-cdd', name: 'Unit CDD / Clearance Logs', kind: 'Excel upload', owner: 'Units', cadence: 'Weekly, manual', lastSync: '21 Sep, 08:15', status: 'degraded', rows: 964 },
  { id: 'ape', name: 'APE Results (out of pilot scope)', kind: 'Excel upload', owner: 'HSEU', cadence: 'Semi-annual', lastSync: '02 Sep, 11:30', status: 'offline', rows: 0 },
  { id: 'doh-outbound', name: 'DOH Reporting (aggregate only)', kind: 'Export pipeline', owner: 'HSEU', cadence: 'On demand', lastSync: '19 Sep, 17:20', status: 'healthy', rows: 0 },
];
