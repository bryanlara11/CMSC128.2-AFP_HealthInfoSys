import { requireSupabase, databaseError } from './supabase';
import type { ExcelCell } from './excelTypes';

export interface SurveillanceRecord {
  id: string; importId: string; sheet: string; excelRow: number; version: number; updatedAt: string;
  assignedUnit: string; filename: string; data: Record<string, ExcelCell>;
}
export interface RecordPage { rows: SurveillanceRecord[]; total: number; headers: string[]; editableHeaders: string[] }

export async function listRecords(offset: number, search: string): Promise<RecordPage> {
  const { data, error } = await requireSupabase().rpc('list_surveillance_records', { p_offset: offset, p_limit: 50, p_search: search || null, p_import_id: null });
  if (error) throw databaseError(error.message, error.code);
  return data;
}

export async function updateRecord(record: SurveillanceRecord, patch: Record<string, ExcelCell>): Promise<void> {
  const { error } = await requireSupabase().rpc('update_surveillance_record', { p_id: record.id, p_patch: patch, p_expected_version: record.version });
  if (error) throw databaseError(error.message, error.code);
}
