/**
 * Front-end deliverables named on page 15 of [HI_CMSC] Overview.pdf:
 *   - "Sample excel format"  -> standardized template built from Table 1
 *   - "Pipeline"             -> rule-based validation (Q&A #1: no AI required)
 *
 * Also implements the Table 5 "Error Batch": 30 malformed records covering the
 * three named defect classes (undated, duplicate IDs, missing required columns).
 */

import { DATA_FIELDS } from './dictionary';
import * as XLSX from 'xlsx';
import { UPLOAD_HEADERS } from './workbook';

/** The seven-column standardized format used by the backend upload demonstration. */
export function downloadExcelTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    UPLOAD_HEADERS,
    ['CASE-001', '2026-09-19', 'Acute Gastroenteritis', 'Unit A', 'Male', '60+', 'Probable'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mock Upload');
  XLSX.writeFile(workbook, 'AFP_HSEU_Standardized_Template.xlsx');
}

/* ------------------------------------------------------------------ */
/*  Standardized template (Table 1 headers)                             */
/* ------------------------------------------------------------------ */

const HEADERS: string[] = DATA_FIELDS.map((f) => f.name);

/** Escapes a value for RFC 4180 CSV. */
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The "mother" template: one header row, one worked example row, no PII. */
export function buildTemplateCsv(): string {
  const example: Record<string, string> = {
    'Record ID': 'CD-2026-000001',
    'Patient ID': '0000-0001-0001',
    Names: 'Dela Cruz, Juan',
    Age: '34',
    Sex: 'Male',
    'Personnel Category': 'Active military',
    'Unit Branch': 'Army',
    'Surveillance Category': 'Communicable / Infectious Diseases',
    Condition: 'Dengue',
    'Service Type': 'OPD',
    'Case Classification': 'Confirmed',
    'Encounter Date': '2026-09-24',
    'Discharge Date': '',
    'Reporting Facility Unit': '525th MC',
    'Logged By Role': 'Medical Technologist',
    'Outcome Status': 'Under Observation',
  };
  return [HEADERS.join(','), HEADERS.map((h) => cell(example[h] ?? '')).join(',')].join('\r\n');
}

export function downloadTemplate(): void {
  const blob = new Blob(['\uFEFF' + buildTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AFP_HSEU_Standardized_Template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Rule-based validator                                                */
/* ------------------------------------------------------------------ */

export type Severity = 'error' | 'warning';

export interface Issue {
  row: number;
  field: string;
  message: string;
  severity: Severity;
  /** Which Table 5 defect class this issue belongs to. */
  defect: 'undated' | 'duplicate-id' | 'missing-required' | 'schema';
}

export interface ValidationResult {
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  accepted: number;
  rejected: number;
  total: number;
}

const DEFECT_LABEL: Record<Issue['defect'], string> = {
  undated: 'Undated',
  'duplicate-id': 'Duplicate ID',
  'missing-required': 'Missing required column',
  schema: 'Schema mismatch',
};

export const defectLabel = (d: Issue['defect']): string => DEFECT_LABEL[d];

/** Optional Table 1 fields warn rather than reject (doc: "may or may not be included"). */
const OPTIONAL = new Set(DATA_FIELDS.filter((f) => !f.required).map((f) => f.name));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Spreadsheet parsers hand back native types — a numeric Age arrives as a
 * number, a date as a Date — so every cell is coerced to a trimmed string
 * before inspection.
 */
const asText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v).trim();
};

export function validateRows(rows: Array<Record<string, unknown>>): ValidationResult {
  const issues: Issue[] = [];
  const seen = new Map<string, number>();

  rows.forEach((rawRow, i) => {
    const rowNo = i + 2; // +1 header, +1 for 1-based display
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) row[k] = asText(v);

    const add = (field: string, message: string, severity: Severity, defect: Issue['defect']) =>
      issues.push({ row: rowNo, field, message, severity, defect });

    for (const f of DATA_FIELDS) {
      const raw = row[f.name] ?? '';

      if (!raw) {
        if (!f.required) continue;
        if (f.type === 'date') add(f.name, 'Required date is missing or empty', 'error', 'undated');
        else add(f.name, `Required field "${f.name}" is empty`, 'error', 'missing-required');
        continue;
      }

      if (f.type === 'date' && !ISO_DATE.test(raw)) {
        add(f.name, `"${raw}" is not an ISO date (YYYY-MM-DD)`, 'error', 'undated');
        continue;
      }

      if (f.type === 'enum' && f.values && !f.values.includes(raw)) {
        const sev: Severity = OPTIONAL.has(f.name) ? 'warning' : 'error';
        add(f.name, `"${raw}" is not an allowed value for ${f.name}`, sev, 'schema');
      }

      if (f.name === 'Patient ID' && !/^\d{4}-\d{4}-\d{4}$/.test(raw)) {
        add(f.name, 'Patient ID must be a 12-digit synthetic identifier (0000-0000-0000)', 'error', 'schema');
      }
    }

    const id = row['Record ID'] ?? '';
    if (id) {
      const first = seen.get(id);
      if (first !== undefined) add('Record ID', `Duplicate Record ID "${id}" (first seen on row ${first})`, 'error', 'duplicate-id');
      else seen.set(id, rowNo);
    }
  });

  const errorRows = new Set(issues.filter((x) => x.severity === 'error').map((x) => x.row));
  const errorCount = issues.filter((x) => x.severity === 'error').length;
  return {
    issues,
    errorCount,
    warningCount: issues.filter((x) => x.severity === 'warning').length,
    accepted: rows.length - errorRows.size,
    rejected: errorRows.size,
    total: rows.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Table 5 — Error Batch: 30 malformed records                         */
/* ------------------------------------------------------------------ */

const VALID_BASE: Record<string, string> = {
  'Record ID': 'CD-2026-000100', 'Patient ID': '0000-0100-0100', Names: 'Santos, Maria',
  Age: '29', Sex: 'Female', 'Personnel Category': 'Civilian employee', 'Unit Branch': 'Air Force',
  'Surveillance Category': 'Communicable / Infectious Diseases', Condition: 'Dengue',
  'Service Type': 'OPD', 'Case Classification': 'Probable', 'Encounter Date': '2026-09-20',
  'Discharge Date': '', 'Reporting Facility Unit': '7th MC', 'Logged By Role': 'Nurse',
  'Outcome Status': 'Admitted',
};

/** 30 rows: 10 undated, 10 duplicate-ID, 10 missing-required, all deterministic. */
export function buildErrorBatch(): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < 30; i++) {
    const row: Record<string, string> = { ...VALID_BASE, 'Record ID': `CD-2026-000${200 + i}` };
    if (i < 10) {
      // Undated: blank / malformed date
      row['Encounter Date'] = i % 2 === 0 ? '' : '09/24/2026';
    } else if (i < 20) {
      // Duplicate ID: all reuse the first valid ID
      row['Record ID'] = 'CD-2026-000200';
    } else {
      // Missing required columns
      delete row.Condition;
      delete row['Service Type'];
      if (i % 2 === 0) delete row['Reporting Facility Unit'];
    }
    rows.push(row);
  }
  return rows;
}

export const ERROR_BATCH_SIZE = 30;

/* ------------------------------------------------------------------ */
/*  Workbook parsing                                                    */
/* ------------------------------------------------------------------ */

export interface ParsedWorkbook {
  rows: Array<Record<string, string>>;
  headerRow: string[];
  sheetName: string;
  sheetNames: string[];
  /** Headers present in the file but not in Table 1, and vice versa. */
  unexpectedHeaders: string[];
  missingHeaders: string[];
}

export class WorkbookError extends Error {}

/**
 * Reads the first sheet of an uploaded workbook.
 *
 * Header matching is whitespace- and case-insensitive so a file saved with
 * "record id" or " Record ID " still lines up with the dictionary, but any
 * genuinely unknown column is reported rather than silently dropped.
 */
export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new WorkbookError('That file could not be read as a spreadsheet.');
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new WorkbookError('The workbook contains no sheets.');

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new WorkbookError(`Sheet "${sheetName}" is empty.`);

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
  if (matrix.length === 0) throw new WorkbookError('The first sheet has no rows.');

  const headerRow = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim());
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const known = new Map<string, string>(DATA_FIELDS.map((f) => [norm(f.name), f.name]));

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] as unknown[];
    if (!raw || raw.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const row: Record<string, string> = {};
    headerRow.forEach((h, c) => {
      if (!h) return;
      const canonical = known.get(norm(h));
      if (!canonical) return;
      const cell = raw[c];
      row[canonical] = cell === null || cell === undefined ? '' : String(cell).trim();
    });
    rows.push(row);
  }

  if (rows.length === 0) throw new WorkbookError('The sheet has headers but no data rows.');

  const seen = new Set(headerRow.filter(Boolean).map(norm));
  return {
    rows,
    headerRow,
    sheetName,
    sheetNames: wb.SheetNames,
    unexpectedHeaders: headerRow.filter((h) => h && !known.has(norm(h))),
    missingHeaders: DATA_FIELDS.filter((f) => f.required && !seen.has(norm(f.name))).map((f) => f.name),
  };
}
