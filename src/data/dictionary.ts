/**
 * AFP Health Information System — normative data definitions.
 *
 * Sourced from "[HI_CMSC] Overview.pdf":
 *   Table 1. Temporal Data (field-level data dictionary)
 *   Table 2. Standardized Categorization (surveillance / diagnosis categories)
 *   Table 3. Possible Dashboard Results
 *   Table 4. Role-Based Access Control
 *   Table 5. Pilot Testing Sampling
 *
 * Single source of truth for the UI. Rule-based, no AI (per Sept 14 2026 Q&A #1).
 */

/* ------------------------------------------------------------------ */
/*  Table 2 — Standardized Categorization                                */
/* ------------------------------------------------------------------ */

export type AccessLevel =
  | 'no-access'
  | 'view'
  | 'view-status'
  | 'edit-view'
  | 'create-edit-view'
  | 'full-access'
  | 'file-upload'
  | 'ingestion-errors';

export interface SurveillanceCategory {
  id: string;
  label: string;
  conditions: string[];
  services: string[];
  metric: string;
  /** Pilot scope per Q&A #4: communicable disease + injury only. */
  inPilotScope: boolean;
}

export const SURVEILLANCE_CATEGORIES: SurveillanceCategory[] = [
  {
    id: 'communicable',
    label: 'Communicable / Infectious Diseases',
    conditions: ['Influenza', 'Dengue', 'Pneumonia', 'UTI', 'Leptospirosis', 'Acute Gastroenteritis'],
    services: ['OPD', 'Inpatient'],
    metric: 'Incidence rate (per week, month, or year)',
    inPilotScope: true,
  },
  {
    id: 'orthopedic',
    label: 'Orthopedic & Rehabilitation',
    conditions: ['ACL Tear', 'Meniscal Tear', 'Osteoarthritis', 'Combat/Training Injuries', 'Fractures'],
    services: ['CDD', 'Evaluation'],
    metric: 'Count of encounters',
    inPilotScope: true,
  },
  {
    id: 'non-communicable',
    label: 'Non-Communicable / Lifestyle Diseases',
    conditions: ['Hypertension', 'Diabetes', 'Heart Failure', 'Gout'],
    services: ['APE', 'OPD'],
    metric: 'Prevalence rate',
    inPilotScope: false,
  },
  {
    id: 'mental-health',
    label: 'Mental Health & Psychological Wellness',
    conditions: ['MDD', 'GAD', 'PTSD'],
    services: ['Clearance'],
    metric: 'Count of clearances',
    inPilotScope: false,
  },
  {
    id: 'womens-health',
    label: "Women's Health & OB-GYN",
    conditions: ['Prenatal/Postnatal Care', 'Gynecological Conditions'],
    services: ['Routine attendance'],
    metric: 'Count of attendances',
    inPilotScope: false,
  },
  {
    id: 'mortality',
    label: 'Mortalities & Severe Casualties',
    conditions: ['Underlying cause', 'Contributing condition'],
    services: ['Tally'],
    metric: 'Confirmed events',
    inPilotScope: false,
  },
];

/** Flat, de-duplicated condition vocabulary derived from Table 2. */
export const CONDITIONS: string[] = Array.from(
  new Set(SURVEILLANCE_CATEGORIES.flatMap((c) => c.conditions)),
).sort();

export const SERVICE_TYPES = ['OPD', 'Emergency', 'Deployment', 'CDD', 'Inpatient', 'APE', 'Clearance'] as const;

export const CASE_CLASSIFICATIONS = ['Suspected', 'Probable', 'Confirmed'] as const;

export const PERSONNEL_CATEGORIES = ['Active military', 'Civilian employee', 'Dependent'] as const;

export const UNIT_BRANCHES = ['Army', 'Navy', 'Air Force', 'Civilian', 'Reservist'] as const;

export const OUTCOME_STATUSES = ['Recovered', 'Admitted', 'Under Observation', 'Referred', 'Expired'] as const;

export const LOGGED_BY_ROLES = ['Doctor', 'Medical Technologist', 'Radiologic Technologist', 'Nurse', 'Physical Therapist'] as const;

export const categoryFor = (condition: string): SurveillanceCategory | undefined =>
  SURVEILLANCE_CATEGORIES.find((c) => c.conditions.includes(condition));

/* ------------------------------------------------------------------ */
/*  Table 1 — Temporal Data (data dictionary)                           */
/* ------------------------------------------------------------------ */

export type FieldGroup = 'Case Identifiers' | 'Demographics' | 'Surveillance/Diagnosis' | 'Clinical Encounter' | 'Reporting';

export interface FieldDef {
  /** Column header used in the standardized Excel template. */
  name: string;
  group: FieldGroup;
  type: 'string' | 'number' | 'enum' | 'date';
  required: boolean;
  values?: readonly string[];
  /** Verbatim note from Table 1. */
  note?: string;
}

/** Record keys holding direct identifiers. */
export const PII_FIELDS = ['patientId', 'names'] as const;

export const DATA_FIELDS: FieldDef[] = [
  { name: 'Record ID', group: 'Case Identifiers', type: 'string', required: true, note: 'Dummy Transaction ID — for pilot testing' },
  { name: 'Patient ID', group: 'Case Identifiers', type: 'string', required: true, note: 'Dummy PhilHealth ID — 12-digit synthetic identifier' },
  { name: 'Names', group: 'Case Identifiers', type: 'string', required: true, note: 'Dummy Names' },

  { name: 'Age', group: 'Demographics', type: 'number', required: true },
  { name: 'Sex', group: 'Demographics', type: 'enum', required: true, values: ['Male', 'Female'] },
  { name: 'Personnel Category', group: 'Demographics', type: 'enum', required: false, values: PERSONNEL_CATEGORIES, note: 'May or may not be included' },
  { name: 'Unit Branch', group: 'Demographics', type: 'enum', required: false, values: UNIT_BRANCHES, note: 'May or may not be included' },

  { name: 'Surveillance Category', group: 'Surveillance/Diagnosis', type: 'enum', required: true, values: SURVEILLANCE_CATEGORIES.map((c) => c.label), note: 'Refer to Table 2' },
  { name: 'Condition', group: 'Surveillance/Diagnosis', type: 'enum', required: true, values: CONDITIONS },

  { name: 'Service Type', group: 'Clinical Encounter', type: 'enum', required: true, values: SERVICE_TYPES, note: 'OPD, Emergency, Deployment, CDD' },
  { name: 'Case Classification', group: 'Clinical Encounter', type: 'enum', required: false, values: CASE_CLASSIFICATIONS, note: 'May or may not be included' },
  { name: 'Encounter Date', group: 'Clinical Encounter', type: 'date', required: true },
  { name: 'Discharge Date', group: 'Clinical Encounter', type: 'date', required: false },

  { name: 'Reporting Facility Unit', group: 'Reporting', type: 'string', required: true, note: 'HSEU or Ward — unit originating the report' },
  { name: 'Logged By Role', group: 'Reporting', type: 'enum', required: true, values: LOGGED_BY_ROLES },
  { name: 'Outcome Status', group: 'Reporting', type: 'enum', required: true, values: OUTCOME_STATUSES },
];

/**
 * Table 1 header names that carry direct identifiers. Callers match on the
 * header (not the record key), so this list must stay aligned with PII_FIELDS.
 */
export const PII_HEADERS: readonly string[] = ['Patient ID', 'Names'];

/* ------------------------------------------------------------------ */
/*  Table 3 — Dashboard results                                          */
/* ------------------------------------------------------------------ */

export const DASHBOARD_METRICS = [
  { key: 'surveillanceCategory', label: 'Surveillance Category', description: 'Grouping (e.g., Communicable Diseases)' },
  { key: 'condition', label: 'Condition / Diagnosis', description: 'Specific disease entity' },
  { key: 'activeCases', label: 'Active / New Cases (Week)', description: 'Count of encounters in the current Epi-Week' },
  { key: 'percentChange', label: 'Percent Change (%)', description: 'Trend indicator (e.g., +15% vs prior week)' },
] as const;

/* ------------------------------------------------------------------ */
/*  Table 4 — Role-based access control                                 */
/* ------------------------------------------------------------------ */

export type Permission =
  | 'demographics'
  | 'clinicalLab'
  | 'physicalExam'
  | 'surveillance'
  | 'audit';

export const PERMISSION_LABELS: Record<Permission, string> = {
  demographics: 'Demographics',
  clinicalLab: 'Clinical Lab Data',
  physicalExam: 'Physical Exam / Fitness Clearance',
  surveillance: 'Surveillance Dashboard / Summary',
  audit: 'Audit Logs / System Control',
};

export interface RoleDef {
  id: string;
  label: string;
  grants: Record<Permission, AccessLevel>;
}

export const ROLES: RoleDef[] = [
  {
    id: 'admin-clerk',
    label: 'Admin / Information Clerk',
    grants: {
      demographics: 'create-edit-view',
      clinicalLab: 'no-access',
      physicalExam: 'view-status',
      surveillance: 'view',
      audit: 'no-access',
    },
  },
  {
    id: 'medtech',
    label: 'Medical Technologist',
    grants: { demographics: 'view', clinicalLab: 'create-edit-view', physicalExam: 'no-access', surveillance: 'no-access', audit: 'file-upload' },
  },
  {
    id: 'radtech',
    label: 'Radiologic Technologist',
    grants: { demographics: 'view', clinicalLab: 'create-edit-view', physicalExam: 'no-access', surveillance: 'no-access', audit: 'file-upload' },
  },
  {
    id: 'physical-therapist',
    label: 'Physical Therapist',
    grants: { demographics: 'view', clinicalLab: 'create-edit-view', physicalExam: 'create-edit-view', surveillance: 'no-access', audit: 'file-upload' },
  },
  {
    id: 'nurse',
    label: 'Nurse',
    grants: { demographics: 'edit-view', clinicalLab: 'create-edit-view', physicalExam: 'create-edit-view', surveillance: 'view', audit: 'file-upload' },
  },
  {
    id: 'medical-officer',
    label: 'Medical Officer (Doctor)',
    grants: { demographics: 'view', clinicalLab: 'create-edit-view', physicalExam: 'create-edit-view', surveillance: 'view', audit: 'view' },
  },
  {
    id: 'hseu-analyst',
    label: 'HSEU Epidemiologist / Analyst',
    grants: { demographics: 'view', clinicalLab: 'view', physicalExam: 'view', surveillance: 'full-access', audit: 'ingestion-errors' },
  },
  {
    id: 'it-personnel',
    label: 'I.T. Personnel',
    grants: { demographics: 'create-edit-view', clinicalLab: 'create-edit-view', physicalExam: 'create-edit-view', surveillance: 'full-access', audit: 'full-access' },
  },
];

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  'no-access': 'No access',
  view: 'View only',
  'view-status': 'View status only',
  'edit-view': 'Edit / View',
  'create-edit-view': 'Create / Edit / View',
  'full-access': 'Full access',
  'file-upload': 'File upload',
  'ingestion-errors': 'View ingestion status & errors',
};

export const canRead = (level: AccessLevel) => level !== 'no-access';

/* ------------------------------------------------------------------ */
/*  Table 5 — Pilot testing sampling                                    */
/* ------------------------------------------------------------------ */

export interface PilotTarget {
  group: string;
  target: string;
  dataType: string;
  objective: string;
  inScope: boolean;
}

export const PILOT_SAMPLING: PilotTarget[] = [
  { group: 'Annual Physical Exam (APE)', target: 'May or may not be included', dataType: '—', objective: 'Excluded from current pilot', inScope: false },
  { group: 'Deployment Health Clearance', target: '20–30 records', dataType: 'Orthopedic & Rehabilitation', objective: 'Validate CDD / combat training injury capture', inScope: true },
  { group: 'Communicable Disease Surveillance', target: '30–50 records', dataType: 'Communicable / Infectious', objective: 'Primary surveillance validation', inScope: true },
  { group: 'Error Batch', target: '30 malformed records', dataType: 'Undated, duplicate IDs, missing required columns', objective: 'Prove the rule-based validator rejects bad input', inScope: true },
];

export const PILOT_TOTAL = '~100 records';
