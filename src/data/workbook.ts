import type { ExcelSheet, ExcelUploadResult } from './api';

export const UPLOAD_HEADERS = ['Case_ID', 'Date_Reported', 'Disease', 'Reporting_Unit', 'Sex', 'Age_Group', 'Case_Classification'];

export function dataSheets(workbook: ExcelUploadResult): ExcelSheet[] {
  return workbook.sheets.filter((sheet) => sheet.name.trim().replace(/\s+/g, ' ').toLowerCase() !== 'how it works');
}

/** Title and description rows in the standard workbook precede its column headers. */
export function sheetTable(sheet: ExcelSheet) {
  const known = new Set(UPLOAD_HEADERS.map((header) => header.toLowerCase()));
  let headerIndex = sheet.rows.findIndex((row) =>
    row.filter((cell) => known.has(String(cell ?? '').trim().toLowerCase())).length >= 2);
  if (headerIndex < 0) {
    headerIndex = sheet.rows.findIndex((row) => row.filter((cell) => String(cell ?? '').trim()).length >= 2);
  }
  // Single-column sheets retain all their values rather than assuming a header.
  const headers = Array.from({ length: sheet.columnCount }, (_, column) =>
    String(sheet.rows[headerIndex]?.[column] ?? '').trim() || `Column ${column + 1}`);
  const notes = headerIndex > 0
    ? sheet.rows.slice(0, headerIndex).map((row) => row.filter((cell) => cell !== null && String(cell).trim()).join(' · ')).filter(Boolean)
    : [];
  const rows = sheet.rows.slice(headerIndex + 1)
    .map((cells, index) => ({ cells, excelRow: headerIndex + index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell !== null && String(cell).trim()));
  return { headers, notes, rows };
}
