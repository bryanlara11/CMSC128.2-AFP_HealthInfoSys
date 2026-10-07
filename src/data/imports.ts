import { isUploadResult, type ExcelUploadResult } from './api';
import { dataSheets, sheetTable } from './workbook';

export const IMPORTS_STORAGE_KEY = 'afp-hseu.imports.v1';

export interface SavedImport {
  id: string;
  dateImported: string;
  importedBy: string;
  workbook: ExcelUploadResult;
}

export function recordCount(workbook: ExcelUploadResult): number {
  return dataSheets(workbook).reduce((total, sheet) => total + sheetTable(sheet).rows.length, 0);
}

export function readImports(storage: Pick<Storage, 'getItem'>): SavedImport[] {
  const raw = storage.getItem(IMPORTS_STORAGE_KEY);
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.every((entry) =>
    entry && typeof entry.id === 'string' && typeof entry.dateImported === 'string' &&
    Number.isFinite(Date.parse(entry.dateImported)) && typeof entry.importedBy === 'string' &&
    isUploadResult(entry.workbook))) {
    throw new Error('Invalid saved imports.');
  }
  return entries;
}

export function writeImports(storage: Pick<Storage, 'setItem'>, entries: SavedImport[]): void {
  storage.setItem(IMPORTS_STORAGE_KEY, JSON.stringify(entries));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('afp-imports-changed'));
}
