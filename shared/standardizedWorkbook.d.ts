import type { ExcelCell, ExcelSheet, ExcelUploadResult } from '../src/data/excelTypes';
export type ImportStatus = 'complete' | 'incomplete' | 'error';
export interface SheetValidation {
  name: string;
  status: ImportStatus;
  reasons: string[];
  missingCount: number;
  recordCount: number;
}
export interface WorkbookValidation {
  schemaVersion: number;
  status: ImportStatus;
  sheets: SheetValidation[];
  recordCount: number;
  missingCount: number;
  reasons: string[];
}
export const UPLOAD_HEADERS: string[];
export function normalizeHeader(value: unknown): string;
export function isMissing(value: unknown): boolean;
export function dataSheets(workbook: ExcelUploadResult): ExcelSheet[];
export function sheetTable(sheet: ExcelSheet): {
  headers: string[]; notes: string[]; headerIndex: number;
  rows: { cells: ExcelCell[]; excelRow: number }[];
};
export function validateWorkbook(workbook: ExcelUploadResult): WorkbookValidation;
