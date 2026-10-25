import { requireSupabase, databaseError } from './supabase';

export interface AuditEvent {
  id: string; timestamp: string; actorName: string; email: string; role: string; unit: string;
  category: 'audit' | 'access'; action: string; entityType: string; entityId: string | null;
  details: Record<string, unknown>;
}
export interface AuditPage { rows: AuditEvent[]; total: number }
export type AccessAction = 'Login' | 'Logout' | 'Session Expired';

export async function logAccess(action: AccessAction): Promise<void> {
  const { error } = await requireSupabase().rpc('record_access_event', { p_action: action });
  if (error) throw databaseError(error.message, error.code);
}

export async function loadAudit(offset = 0, category: string | null = null, search = '', own = false, limit = 50): Promise<AuditPage> {
  const { data, error } = await requireSupabase().rpc('list_audit_events', {
    p_offset: offset, p_limit: limit, p_category: category, p_search: search || null, p_own: own,
  });
  if (error) throw databaseError(error.message, error.code);
  return data;
}

export function describeEvent(event: AuditEvent): string {
  const details = event.details;
  if (Array.isArray(details.changedFields)) return `Changed ${details.changedFields.join(', ')} · worksheet ${details.sheet}, row ${details.excelRow}`;
  if (details.filename) return `${details.filename} · ${details.status} · ${details.recordCount ?? 0} records`;
  if (event.action === 'Export') return `${details.format} · ${details.records} records · ${details.groups} aggregate groups`;
  if (details.records !== undefined) return `${details.records} records in scope`;
  if (details.returned !== undefined) return `${details.returned} records viewed`;
  if (event.action === 'Update Profile') return 'Profile details updated';
  return event.entityType;
}
