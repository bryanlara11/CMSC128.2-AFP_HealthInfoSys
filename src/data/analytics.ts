import type { SavedImport } from './imports';
import { dataSheets, sheetTable } from './workbook';

export type DatePreset = 'last7' | 'last14' | 'thisMonth' | 'lastMonth' | 'custom';
export interface DateRange { start: string; end: string }
export interface AnalysisRecord {
  key: string;
  caseId: string;
  date: string;
  disease: string;
  unit: string;
  ageGroup: string;
  sex: string;
  classification: string;
  source: string;
}
export interface CaseCount { name: string; cases: number }

const DAY = 86_400_000;
const text = (value: unknown) => String(value ?? '').trim();
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '');
const utcDate = (value: string) => new Date(`${value}T00:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = utcDate(value);
  return Number.isFinite(date.getTime()) && iso(date) === value;
}

export function dateRange(preset: DatePreset, today: string, custom: DateRange): DateRange | null {
  if (preset === 'custom') return validDate(custom.start) && validDate(custom.end) && custom.start <= custom.end ? custom : null;
  const end = utcDate(today);
  if (preset === 'lastMonth') {
    const last = new Date(end);
    last.setUTCDate(0);
    const first = new Date(last);
    first.setUTCDate(1);
    return { start: iso(first), end: iso(last) };
  }
  const start = new Date(end);
  if (preset === 'thisMonth') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (preset === 'last14' ? 13 : 6));
  return { start: iso(start), end: today };
}

function ageBand(value: string): string {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return 'Not specified';
  const age = Number(value);
  if (age > 120) return 'Not specified';
  if (age < 18) return '0–17';
  if (age < 30) return '18–29';
  if (age < 45) return '30–44';
  if (age < 60) return '45–59';
  return '60+';
}

/** Newest upload wins when the same case identifier is uploaded more than once. */
export function importedRecords(imports: SavedImport[]) {
  const records: AnalysisRecord[] = [];
  const seen = new Set<string>();
  const diseases = new Map<string, string>();
  const units = new Map<string, string>();
  let invalidDates = 0;
  let duplicates = 0;
  let unsupportedSheets = 0;
  const newestFirst = [...imports].sort((a, b) => b.dateImported.localeCompare(a.dateImported));
  for (const entry of newestFirst) {
    for (const sheet of dataSheets(entry.workbook)) {
      const table = sheetTable(sheet);
      const columns = new Map(table.headers.map((header, index) => [normalizeHeader(header), index]));
      const findColumn = (...names: string[]) => names.map(normalizeHeader).find((name) => columns.has(name));
      const dateColumn = findColumn('Date_Reported', 'Encounter Date');
      const diseaseColumn = findColumn('Disease', 'Condition');
      if (!dateColumn || !diseaseColumn) { unsupportedSheets++; continue; }
      for (const row of table.rows) {
        const read = (...names: string[]) => {
          const column = findColumn(...names);
          return column ? text(row.cells[columns.get(column)!]) : '';
        };
        const rawDate = read('Date_Reported', 'Encounter Date');
        const date = /^\d{4}-\d{2}-\d{2}T/.test(rawDate) ? rawDate.slice(0, 10) : rawDate;
        if (!validDate(date)) { invalidDates++; continue; }
        const caseId = read('Case_ID', 'Record ID');
        const uniqueId = caseId.toLowerCase();
        if (uniqueId && seen.has(uniqueId)) { duplicates++; continue; }
        if (uniqueId) seen.add(uniqueId);
        const canonical = (value: string, values: Map<string, string>) => {
          const name = value || 'Not specified';
          const key = name.toLowerCase();
          if (!values.has(key)) values.set(key, name);
          return values.get(key)!;
        };
        const sex = read('Sex');
        records.push({
          key: `${entry.id}:${sheet.name}:${row.excelRow}`, caseId,
          date, disease: canonical(read('Disease', 'Condition'), diseases),
          unit: canonical(read('Reporting_Unit', 'Reporting Facility Unit'), units),
          ageGroup: read('Age_Group').replace(/\s*[-–]\s*/g, '–') || ageBand(read('Age')),
          sex: /^(m|male)$/i.test(sex) ? 'Male' : /^(f|female)$/i.test(sex) ? 'Female' : sex || 'Not specified',
          classification: read('Case_Classification', 'Case Classification') || 'Not specified',
          source: entry.workbook.filename,
        });
      }
    }
  }
  records.sort((a, b) => b.date.localeCompare(a.date) || a.caseId.localeCompare(b.caseId));
  return { records, invalidDates, duplicates, unsupportedSheets };
}

export function filterRecords(records: AnalysisRecord[], range: DateRange | null, disease = ''): AnalysisRecord[] {
  if (!range) return [];
  return records.filter((record) => record.date >= range.start && record.date <= range.end && (!disease || record.disease === disease));
}

export function caseCounts(records: AnalysisRecord[], field: 'disease' | 'ageGroup' | 'sex'): CaseCount[] {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) ?? 0) + 1);
  const result = Array.from(counts, ([name, cases]) => ({ name, cases }));
  return field === 'ageGroup'
    ? result.sort((a, b) => {
      const age = (name: string) => Number.isNaN(Number.parseInt(name)) ? Infinity : Number.parseInt(name);
      return age(a.name) - age(b.name) || a.name.localeCompare(b.name);
    })
    : result.sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
}

export function summary(records: AnalysisRecord[]) {
  const diseases = caseCounts(records, 'disease');
  const leaders = diseases.filter((item) => item.cases === diseases[0]?.cases);
  const units = new Set(records.filter((record) => record.unit !== 'Not specified').map((record) => record.unit.toLowerCase()));
  return { total: records.length, leaders, units: units.size };
}

export function diseaseTrends(records: AnalysisRecord[], range: DateRange | null) {
  const diseases = caseCounts(records, 'disease').map((item, index) => ({ name: item.name, key: `d${index}` }));
  const rows: Array<{ [key: string]: string | number; date: string; end: string }> = [];
  if (!range) return { diseases, rows, interval: 'day' as const };
  const days = (utcDate(range.end).getTime() - utcDate(range.start).getTime()) / DAY + 1;
  const interval = days <= 60 ? 'day' : days <= 366 ? 'week' : 'month';
  const cursor = utcDate(range.start);
  const endTime = utcDate(range.end).getTime();
  while (cursor.getTime() <= endTime) {
    const start = iso(cursor);
    if (interval === 'month') { cursor.setUTCDate(1); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
    else cursor.setUTCDate(cursor.getUTCDate() + (interval === 'day' ? 1 : 7));
    const end = new Date(cursor.getTime() - DAY);
    const row: { [key: string]: string | number; date: string; end: string } = { date: start, end: iso(end) < range.end ? iso(end) : range.end };
    for (const disease of diseases) row[disease.key] = 0;
    rows.push(row);
  }
  const keys = new Map(diseases.map((disease) => [disease.name, disease.key]));
  for (const record of records) {
    // Binary search avoids allocating one entry for every day of a long custom range.
    let low = 0;
    let high = rows.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (rows[middle]!.date <= record.date) low = middle + 1;
      else high = middle - 1;
    }
    const row = rows[high];
    const key = keys.get(record.disease);
    if (row && record.date <= row.end && key) row[key] = Number(row[key]) + 1;
  }
  return { diseases, rows, interval };
}
