/**
 * Centralized Audit & Access Log store.
 *
 * Captures two kinds of events:
 *  1. **Audit logs** — every CRUD operation performed by any user
 *     (import, export, edit, delete, view, download template, validate, etc.)
 *  2. **Access logs** — login and logout events for every user.
 *
 * The store is in-memory (no persistence) and ships with synthetic seed data
 * so the admin's Logs tab is never empty during the demo.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type AuditOperation =
  | 'Import'
  | 'Export'
  | 'Edit'
  | 'Delete'
  | 'View'
  | 'Create'
  | 'Download Template'
  | 'Validate'
  | 'Apply Filter'
  | 'Save Filter'
  | 'Generate Report';

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  unit: string;
  operation: AuditOperation;
  details: string;
}

export type AccessAction = 'Login' | 'Logout' | 'Session Expired';

export interface AccessEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: AccessAction;
  ip: string;
}

/* ------------------------------------------------------------------ */
/*  In-memory stores                                                    */
/* ------------------------------------------------------------------ */

let _auditIdCounter = 1000;
let _accessIdCounter = 1000;

const _auditLogs: AuditEntry[] = [];
const _accessLogs: AccessEntry[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function now(): string {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function nextAuditId(): string {
  return `AUD-${++_auditIdCounter}`;
}

function nextAccessId(): string {
  return `ACC-${++_accessIdCounter}`;
}

/** Simulated IP for demo purposes. */
function randomIp(): string {
  const seg = () => Math.floor(Math.random() * 254) + 1;
  return `10.24.${seg()}.${seg()}`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/** Record a CRUD / data operation. */
export function logAudit(
  user: string,
  role: string,
  unit: string,
  operation: AuditOperation,
  details: string,
): void {
  _auditLogs.unshift({
    id: nextAuditId(),
    timestamp: now(),
    user,
    role,
    unit,
    operation,
    details,
  });
}

/** Record a login / logout event. */
export function logAccess(
  user: string,
  role: string,
  action: AccessAction,
): void {
  _accessLogs.unshift({
    id: nextAccessId(),
    timestamp: now(),
    user,
    role,
    action,
    ip: randomIp(),
  });
}

/** Return all audit log entries (newest first). */
export function getAuditLogs(): readonly AuditEntry[] {
  return _auditLogs;
}

/** Return all access log entries (newest first). */
export function getAccessLogs(): readonly AccessEntry[] {
  return _accessLogs;
}

/* ------------------------------------------------------------------ */
/*  Seed data — synthetic entries so the log is never empty             */
/* ------------------------------------------------------------------ */

const SEED_AUDIT: Omit<AuditEntry, 'id'>[] = [
  { timestamp: '2026-10-25 09:45:12', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Import', details: 'HSEU_Communicable_Oct_2026.xlsx — 48 records ingested' },
  { timestamp: '2026-10-25 09:32:07', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', unit: 'HSEU', operation: 'Export', details: 'AFP_HSEU_Epi_Week_43.csv — anonymized, PII stripped' },
  { timestamp: '2026-10-25 09:18:44', user: 'nurse_test@email.com', role: 'Nurse', unit: '525th MC', operation: 'Edit', details: 'Record CD-2026-001245 — updated Outcome Status to "Recovered"' },
  { timestamp: '2026-10-25 08:55:20', user: 'medtech_test@email.com', role: 'Medical Technologist', unit: '3rd MC', operation: 'Import', details: 'Lab_Results_Batch_Oct25.xlsx — 22 records ingested' },
  { timestamp: '2026-10-25 08:40:15', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Download Template', details: 'Standard 7-column surveillance template (.xlsx)' },
  { timestamp: '2026-10-25 08:22:33', user: 'medical_officer_test@email.com', role: 'Medical Officer (Doctor)', unit: '11th MC', operation: 'View', details: 'Patient records — Dengue cases, NCR region' },
  { timestamp: '2026-10-24 17:10:50', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', unit: 'HSEU', operation: 'Generate Report', details: 'Weekly Epidemiological Report — Epi Week 43' },
  { timestamp: '2026-10-24 16:45:18', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Validate', details: 'Error batch — 30 malformed records, 28 rejected' },
  { timestamp: '2026-10-24 15:30:02', user: 'physical_therapist_test@email.com', role: 'Physical Therapist', unit: '7th MC', operation: 'Import', details: 'Ortho_Rehab_CDD_Oct24.xlsx — 15 records ingested' },
  { timestamp: '2026-10-24 14:55:44', user: 'admin_clerk_test@email.com', role: 'Admin / Information Clerk', unit: '21st MC', operation: 'Create', details: 'New patient record — Personnel Category: Active military' },
  { timestamp: '2026-10-24 14:12:30', user: 'nurse_test@email.com', role: 'Nurse', unit: '525th MC', operation: 'Edit', details: 'Record CD-2026-001200 — corrected Age from 32 to 34' },
  { timestamp: '2026-10-24 13:40:09', user: 'radtech_test@email.com', role: 'Radiologic Technologist', unit: '2nd MC', operation: 'Import', details: 'Imaging_Results_Oct24.xlsx — 8 records ingested' },
  { timestamp: '2026-10-24 11:20:55', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Delete', details: 'Removed duplicate record CD-2026-000998' },
  { timestamp: '2026-10-24 10:05:18', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', unit: 'HSEU', operation: 'Apply Filter', details: 'Surveillance dashboard — Communicable diseases, Luzon, Sep–Oct 2026' },
  { timestamp: '2026-10-24 09:30:42', user: 'medical_officer_test@email.com', role: 'Medical Officer (Doctor)', unit: '11th MC', operation: 'View', details: 'Surveillance dashboard — Orthopedic & Rehabilitation trends' },
  { timestamp: '2026-10-23 16:55:30', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Export', details: 'AFP_HSEU_Aggregate_Export.csv — full dataset, anonymized' },
  { timestamp: '2026-10-23 15:20:11', user: 'nurse_test@email.com', role: 'Nurse', unit: '525th MC', operation: 'Create', details: 'New patient record — Condition: Influenza, Classification: Suspected' },
  { timestamp: '2026-10-23 14:00:45', user: 'admin_clerk_test@email.com', role: 'Admin / Information Clerk', unit: '21st MC', operation: 'Edit', details: 'Record CD-2026-001180 — updated Names field' },
  { timestamp: '2026-10-23 11:30:22', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', unit: 'HSEU', operation: 'Save Filter', details: 'Saved filter preset "Dengue NCR Weekly"' },
  { timestamp: '2026-10-23 09:15:08', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', unit: 'HSEU', operation: 'Import', details: 'HSEU_Deployment_Clearance_Oct23.xlsx — 25 records ingested' },
];

const SEED_ACCESS: Omit<AccessEntry, 'id'>[] = [
  { timestamp: '2026-10-25 09:42:00', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', action: 'Login', ip: '10.24.7.118' },
  { timestamp: '2026-10-25 09:30:15', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', action: 'Login', ip: '10.24.9.031' },
  { timestamp: '2026-10-25 09:15:42', user: 'nurse_test@email.com', role: 'Nurse', action: 'Login', ip: '10.24.7.204' },
  { timestamp: '2026-10-25 08:52:10', user: 'medtech_test@email.com', role: 'Medical Technologist', action: 'Login', ip: '10.24.8.155' },
  { timestamp: '2026-10-25 08:20:30', user: 'medical_officer_test@email.com', role: 'Medical Officer (Doctor)', action: 'Login', ip: '10.24.7.072' },
  { timestamp: '2026-10-24 18:05:00', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', action: 'Logout', ip: '10.24.9.031' },
  { timestamp: '2026-10-24 17:30:22', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', action: 'Logout', ip: '10.24.7.118' },
  { timestamp: '2026-10-24 17:15:44', user: 'nurse_test@email.com', role: 'Nurse', action: 'Session Expired', ip: '10.24.7.204' },
  { timestamp: '2026-10-24 16:40:10', user: 'physical_therapist_test@email.com', role: 'Physical Therapist', action: 'Login', ip: '10.24.8.092' },
  { timestamp: '2026-10-24 15:55:33', user: 'admin_clerk_test@email.com', role: 'Admin / Information Clerk', action: 'Login', ip: '10.24.7.180' },
  { timestamp: '2026-10-24 14:10:05', user: 'radtech_test@email.com', role: 'Radiologic Technologist', action: 'Login', ip: '10.24.8.210' },
  { timestamp: '2026-10-24 13:00:18', user: 'radtech_test@email.com', role: 'Radiologic Technologist', action: 'Logout', ip: '10.24.8.210' },
  { timestamp: '2026-10-24 09:45:50', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', action: 'Login', ip: '10.24.7.118' },
  { timestamp: '2026-10-24 09:30:12', user: 'hseu_analyst_test@email.com', role: 'HSEU Epidemiologist / Analyst', action: 'Login', ip: '10.24.9.031' },
  { timestamp: '2026-10-24 09:20:40', user: 'medical_officer_test@email.com', role: 'Medical Officer (Doctor)', action: 'Login', ip: '10.24.7.072' },
  { timestamp: '2026-10-23 17:45:22', user: 'admin_clerk_test@email.com', role: 'Admin / Information Clerk', action: 'Logout', ip: '10.24.7.180' },
  { timestamp: '2026-10-23 17:00:10', user: 'nurse_test@email.com', role: 'Nurse', action: 'Logout', ip: '10.24.7.204' },
  { timestamp: '2026-10-23 16:30:55', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', action: 'Session Expired', ip: '10.24.7.118' },
  { timestamp: '2026-10-23 09:10:00', user: 'it_personnel_test@email.com', role: 'I.T. Personnel', action: 'Login', ip: '10.24.7.118' },
  { timestamp: '2026-10-23 08:50:30', user: 'nurse_test@email.com', role: 'Nurse', action: 'Login', ip: '10.24.7.204' },
];

/* Populate on module load. */
for (const s of SEED_AUDIT) {
  _auditLogs.push({ ...s, id: nextAuditId() });
}
for (const s of SEED_ACCESS) {
  _accessLogs.push({ ...s, id: nextAccessId() });
}
