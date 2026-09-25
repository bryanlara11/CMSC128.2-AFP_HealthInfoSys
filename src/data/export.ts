/**
 * CSV generation for the surveillance records, driven by the Table 1 field list.
 *
 * When PII stripping is on (the default, per Q&A #3), the two identifier columns
 * are dropped entirely — not blanked — so the exported file cannot leak them.
 * That mirrors "reporting to external bodies will only expose the overall".
 */

import { DATA_FIELDS } from './dictionary';
import { isPiiField, type Record_ } from './records';

/** Table 1 header name -> key on Record_. */
const KEY_BY_HEADER: Record<string, keyof Record_ | 'location' | 'condition'> = {
  'Record ID': 'recordId',
  'Patient ID': 'patientId',
  Names: 'names',
  Age: 'age',
  Sex: 'sex',
  'Personnel Category': 'personnelCategory',
  'Unit Branch': 'unitBranch',
  'Surveillance Category': 'surveillanceCategory',
  Condition: 'condition',
  'Service Type': 'serviceType',
  'Case Classification': 'caseClassification',
  'Encounter Date': 'encounterDate',
  'Discharge Date': 'dischargeDate',
  'Reporting Facility Unit': 'reportingFacilityUnit',
  'Logged By Role': 'loggedByRole',
  'Outcome Status': 'outcomeStatus',
  Location: 'location',
};

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface ExportColumn {
  header: string;
  key: keyof Record_ | 'location' | 'condition';
  pii: boolean;
}

/** Columns for the grid/export, honouring the strip flag. */
export function exportColumns(stripPii: boolean): ExportColumn[] {
  const base = DATA_FIELDS.map((f) => ({
    header: f.name,
    key: KEY_BY_HEADER[f.name]!,
    pii: isPiiField(f.name),
  }));
  /* Location is not a Table 1 field but is carried by the pilot dataset, and it is
     not identifying, so it is exported either way. */
  const location: ExportColumn = { header: 'Location', key: 'location', pii: false };
  return stripPii ? [...base.filter((c) => !c.pii), location] : [...base, location];
}

export function toCsv(rows: Record_[], stripPii: boolean): string {
  const cols = exportColumns(stripPii);
  const lines = [cols.map((c) => cell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => cell(row[c.key])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, rows: Record_[], stripPii: boolean): void {
  const blob = new Blob(['\uFEFF' + toCsv(rows, stripPii)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
