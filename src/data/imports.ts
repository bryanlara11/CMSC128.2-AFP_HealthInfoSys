import type { ExcelUploadResult } from './excelTypes';
import { validateWorkbook, type WorkbookValidation } from './workbook';
import type { UploaderProfile } from './profile';

export interface SavedImport {
  id: string;
  dateImported: string;
  importedBy: string;
  workbook: ExcelUploadResult;
  uploader?: UploaderProfile;
  error?: string;
  validation?: WorkbookValidation;
  metadataOnly?: boolean;
}

export function importValidation(entry: SavedImport): WorkbookValidation {
  const validation = entry.validation ?? validateWorkbook(entry.workbook);
  return entry.error ? { ...validation, status: 'error', reasons: [entry.error], recordCount: 0 } : validation;
}
