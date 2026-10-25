import type { WorkbookValidation } from '../../shared/standardizedWorkbook.js';

export type ExcelCell = string | number | boolean | null;

export interface ExcelSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  rows: ExcelCell[][];
}

export interface ExcelUploadResult {
  filename: string;
  sheets: ExcelSheet[];
  validation?: WorkbookValidation;
}

export const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isUploadResult(value: unknown): value is ExcelUploadResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ExcelUploadResult;
  return typeof result.filename === 'string' && Array.isArray(result.sheets) &&
    result.sheets.every((sheet) => sheet && typeof sheet.name === 'string' &&
      Number.isInteger(sheet.rowCount) && sheet.rowCount >= 0 &&
      Number.isInteger(sheet.columnCount) && sheet.columnCount >= 0 &&
      Array.isArray(sheet.rows) && sheet.rowCount === sheet.rows.length &&
      sheet.rows.every((row) => Array.isArray(row) && row.length === sheet.columnCount &&
        row.every((cell) => cell === null || ['string', 'number', 'boolean'].includes(typeof cell))));
}
