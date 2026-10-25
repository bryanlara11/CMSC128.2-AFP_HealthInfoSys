import { requireSupabase, databaseError } from './supabase';
import { isUploadResult, type ExcelUploadResult } from './excelTypes';
import type { SavedImport } from './imports';
import type { UploaderProfile } from './profile';
import type { WorkbookValidation } from './workbook';

interface ImportRow {
  id: string;
  date_imported: string;
  uploader: UploaderProfile;
  workbook: ExcelUploadResult;
  validation: WorkbookValidation;
  metadata_only: boolean;
  upload_error: string | null;
}

export function mapImport(row: ImportRow): SavedImport {
  if (!isUploadResult(row.workbook)) throw new Error('Supabase returned an invalid workbook.');
  return {
    id: row.id, dateImported: row.date_imported, importedBy: row.uploader.fullName,
    uploader: row.uploader, workbook: { ...row.workbook, validation: row.validation },
    validation: row.validation, metadataOnly: row.metadata_only,
    ...(row.upload_error ? { error: row.upload_error } : {}),
  };
}

export async function listImports(): Promise<SavedImport[]> {
  const { data, error } = await requireSupabase().rpc('list_surveillance_imports');
  if (error) throw databaseError(error.message, error.code);
  return (data as ImportRow[]).map(mapImport);
}

export async function saveImport(workbook: ExcelUploadResult, uploadError?: string): Promise<string> {
  const { validation: _preview, ...source } = workbook;
  const { data, error } = await requireSupabase().rpc('save_surveillance_workbook', {
    p_id: crypto.randomUUID(), p_workbook: source, p_error: uploadError ?? null,
  });
  if (error) throw databaseError(error.message, error.code);
  return data as string;
}

export async function deleteImport(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_surveillance_import', { p_id: id });
  if (error) throw databaseError(error.message, error.code);
}
