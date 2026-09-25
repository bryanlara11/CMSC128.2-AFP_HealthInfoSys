/**
 * Synthetic pilot dataset conforming to Table 1 (Temporal Data) of [HI_CMSC] Overview.pdf.
 *
 * Deterministic: a fixed seed means the same 100 records on every render, which
 * matters for a graded demo. All identifiers are fabricated — Patient ID follows
 * the 12-digit synthetic PhilHealth shape, Names are drawn from a dummy pool.
 *
 * Vocabulary is restricted to Table 2 conditions, and the in-pilot categories
 * (communicable + orthopedic) per Q&A #4.
 */

import {
  CASE_CLASSIFICATIONS, SERVICE_TYPES, PERSONNEL_CATEGORIES,
  UNIT_BRANCHES, OUTCOME_STATUSES, LOGGED_BY_ROLES, PII_HEADERS, DATA_FIELDS, categoryFor,
  type SurveillanceCategory,
} from './dictionary';

export interface Record_ {
  /* Case Identifiers */
  recordId: string;
  patientId: string;
  names: string;
  /* Demographics */
  age: number;
  sex: 'Male' | 'Female';
  personnelCategory: string;
  unitBranch: string;
  /* Surveillance / Diagnosis */
  surveillanceCategory: string;
  condition: string;
  /* Clinical Encounter */
  serviceType: string;
  caseClassification: string;
  encounterDate: string;
  dischargeDate: string;
  /* Reporting */
  reportingFacilityUnit: string;
  loggedByRole: string;
  outcomeStatus: string;
  /* Presentation-only (mockup reference, not in Table 1) */
  location: string;
}

/* ---- deterministic PRNG (mulberry32) ---- */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

const SURNAMES = ['Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Aquino', 'Villanueva', 'Castillo'];
const FIRST_M = ['Juan', 'Pedro', 'Miguel', 'Andres', 'Carlo', 'Ramon', 'Jose', 'Emilio'];
const FIRST_F = ['Maria', 'Ana', 'Rosa', 'Cristina', 'Luisa', 'Divina', 'Teresita', 'Angeline'];

const UNITS = ['525th MC', '3rd MC', '11th MC', '7th MC', '21st MC', '2nd MC', '14th MC', '8th MC', '19th MC', 'Hospital MABINI'];
const LOCATIONS = ['Luzon', 'NCR', 'Visayas', 'Mindanao'];

/** Table 2 conditions, limited to the two in-pilot categories. */
const PILOT_CONDITIONS = ['Influenza', 'Dengue', 'Pneumonia', 'UTI', 'Leptospirosis', 'Acute Gastroenteritis',
  'ACL Tear', 'Meniscal Tear', 'Osteoarthritis', 'Combat/Training Injuries', 'Fractures'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => new Date(base.getTime() + n * 86400000);

/** 12-digit synthetic PhilHealth-shaped identifier: 4-4-4. */
const synthPatientId = (r: () => number, i: number) =>
  `0000-${String(1000 + i).slice(-4)}-${String(Math.floor(r() * 9000) + 1000)}`;

/** The two records fixed by the mockup, expressed in Table 2 vocabulary. */
const ANCHORS: Array<Partial<Record_> & { recordId: string; condition: string }> = [
  { recordId: 'CD-2026-001245', condition: 'Dengue', caseClassification: 'Confirmed', reportingFacilityUnit: '525th MC', location: 'Luzon', age: 34, sex: 'Male' },
  { recordId: 'CD-2026-001244', condition: 'Pneumonia', caseClassification: 'Probable', reportingFacilityUnit: '3rd MC', location: 'NCR', age: 27, sex: 'Female' },
];

function build(): Record_[] {
  const r = rng(20260924);
  const out: Record_[] = [];
  const base = new Date('2026-09-24T00:00:00Z');

  for (let i = 0; i < 100; i++) {
    const anchor = i < ANCHORS.length ? ANCHORS[i]! : undefined;
    const condition = anchor?.condition ?? pick(r, PILOT_CONDITIONS);
    const cat: SurveillanceCategory | undefined = categoryFor(condition);
    const encOffset = -(Math.floor(r() * 28) + 1);
    const encounter = addDays(base, encOffset);
    const male = (anchor?.sex ?? pick(r, ['Male', 'Female'] as const)) === 'Male';
    const idNum = 1245 - i;

    out.push({
      recordId: anchor?.recordId ?? `CD-2026-${String(idNum).padStart(6, '0')}`,
      patientId: synthPatientId(r, i),
      names: `${male ? pick(r, FIRST_M) : pick(r, FIRST_F)} ${pick(r, SURNAMES)}`,
      age: anchor?.age ?? Math.floor(r() * 60) + 19,
      sex: male ? 'Male' : 'Female',
      personnelCategory: pick(r, PERSONNEL_CATEGORIES),
      unitBranch: pick(r, UNIT_BRANCHES),
      surveillanceCategory: cat?.label ?? 'Communicable / Infectious Diseases',
      condition,
      serviceType: pick(r, SERVICE_TYPES),
      caseClassification: anchor?.caseClassification ?? pick(r, CASE_CLASSIFICATIONS),
      encounterDate: iso(encounter),
      dischargeDate: r() > 0.18 ? iso(addDays(encounter, Math.floor(r() * 6) + 1)) : '',
      reportingFacilityUnit: anchor?.reportingFacilityUnit ?? pick(r, UNITS),
      loggedByRole: pick(r, LOGGED_BY_ROLES),
      outcomeStatus: pick(r, OUTCOME_STATUSES),
      location: anchor?.location ?? pick(r, LOCATIONS),
    });
  }
  return out;
}

export const RECORDS: Record_[] = build();

/** Conditions actually present in the dataset, for filter dropdowns. */
export const CONDITIONS_PRESENT: string[] = Array.from(new Set(RECORDS.map((r) => r.condition))).sort();

/** True for the Table 1 fields that must never reach an external report. */
export const isPiiField = (header: string): boolean => PII_HEADERS.includes(header);

/* Guard: PII_HEADERS and PII_FIELDS are maintained separately, so assert that
   every flagged header actually exists in Table 1. A typo here would silently
   disable PII stripping, which is the failure mode worth guarding against. */
for (const h of PII_HEADERS) {
  if (!DATA_FIELDS.some((f) => f.name === h)) {
    throw new Error(`PII_HEADERS lists "${h}", which is not a Table 1 field`);
  }
}
