/**
 * Verifies the four gaps closed against [HI_CMSC] Overview.pdf:
 *   A. Table 2 vocabulary  B. Table 1 fields  C. Table 5 error batch  D. Table 4 RBAC
 */

import {
  DATA_FIELDS, ROLES, CONDITIONS, SURVEILLANCE_CATEGORIES, CASE_CLASSIFICATIONS,
  ACCESS_LABELS, type AccessLevel, type Permission,
} from './dictionary';
import { RECORDS, isPiiField, type Record_ } from './records';
import { validateRows, buildErrorBatch, buildTemplateCsv, ERROR_BATCH_SIZE } from './pipeline';
import { exportColumns, toCsv } from './export';

let failed = 0;
const check = (l: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}`);
};

/* ---------------- A. Table 2 vocabulary ---------------- */
console.log('=== A. Table 2 vocabulary is enforced everywhere ===');
const FORBIDDEN = ['COVID-19', 'COVID', 'Typhoid', 'Measles', 'Malaria', 'ARI', 'Severe Acute Malnutrition'];
for (const bad of FORBIDDEN) {
  check(`"${bad}" absent from dataset`, !RECORDS.some((r) => JSON.stringify(r).includes(bad)));
}
check('every record condition is a Table 2 condition', RECORDS.every((r) => CONDITIONS.includes(r.condition)));
check('every record category matches its condition', RECORDS.every((r) =>
  SURVEILLANCE_CATEGORIES.some((c) => c.label === r.surveillanceCategory && c.conditions.includes(r.condition))));
check('only in-pilot categories present', RECORDS.every((r) =>
  SURVEILLANCE_CATEGORIES.find((c) => c.label === r.surveillanceCategory)?.inPilotScope));
check('anchored Dengue record kept', RECORDS[0]!.recordId === 'CD-2026-001245' && RECORDS[0]!.condition === 'Dengue' && RECORDS[0]!.reportingFacilityUnit === '525th MC');
check('anchored second record is Table 2 Pneumonia', RECORDS[1]!.recordId === 'CD-2026-001244' && RECORDS[1]!.condition === 'Pneumonia' && RECORDS[1]!.reportingFacilityUnit === '3rd MC');
check('all classifications from Table 1 enum', RECORDS.every((r) => CASE_CLASSIFICATIONS.includes(r.caseClassification as never)));

/* ---------------- B. Table 1 fields ---------------- */
console.log('\n=== B. Table 1 fields in data, grid and export ===');
const KEYS: Record<string, keyof Record_> = {
  'Record ID': 'recordId', 'Patient ID': 'patientId', Names: 'names', Age: 'age', Sex: 'sex',
  'Personnel Category': 'personnelCategory', 'Unit Branch': 'unitBranch',
  'Surveillance Category': 'surveillanceCategory', Condition: 'condition',
  'Service Type': 'serviceType', 'Case Classification': 'caseClassification',
  'Encounter Date': 'encounterDate', 'Discharge Date': 'dischargeDate',
  'Reporting Facility Unit': 'reportingFacilityUnit', 'Logged By Role': 'loggedByRole',
  'Outcome Status': 'outcomeStatus',
};
for (const [header, key] of Object.entries(KEYS)) {
  const def = DATA_FIELDS.find((f) => f.name === header)!;
  const optional = !def.required;
  const ok = RECORDS.every((r) => (optional ? true : String(r[key] ?? '').length > 0));
  check(`"${header}" populated on every record`, ok);
}
check('Patient ID is 12-digit synthetic', RECORDS.every((r) => /^\d{4}-\d{4}-\d{4}$/.test(r.patientId)));
check('Record IDs unique', new Set(RECORDS.map((r) => r.recordId)).size === RECORDS.length);
check('pilot volume ~100 records', RECORDS.length === 100);

const stripped = exportColumns(true);
const full = exportColumns(false);
check('strip=true drops exactly the 2 PII columns', stripped.length === full.length - 2);
check('Patient ID dropped when stripping', !stripped.some((c) => c.header === 'Patient ID'));
check('Names dropped when stripping', !stripped.some((c) => c.header === 'Names'));
check('PII columns present when stripping is off', full.some((c) => c.header === 'Patient ID') && full.some((c) => c.header === 'Names'));
check('isPiiField flags exactly 2 fields', DATA_FIELDS.filter((f) => isPiiField(f.name)).length === 2);

const csvStrip = toCsv(RECORDS.slice(0, 5), true);
const csvFull = toCsv(RECORDS.slice(0, 5), false);
check('stripped CSV header has no Patient ID', !csvStrip.split('\r\n')[0]!.includes('Patient ID'));
check('full CSV header has Patient ID', csvFull.split('\r\n')[0]!.includes('Patient ID'));
check('stripped CSV has no real patient names', !RECORDS.slice(0, 5).some((r) => csvStrip.includes(r.names)));
check('CSV row count matches records + header', csvStrip.trim().split('\r\n').length === 6);
check('Service Type in export', stripped.some((c) => c.header === 'Service Type'));
check('Outcome Status in export', stripped.some((c) => c.header === 'Outcome Status'));
check('Logged By Role in export', stripped.some((c) => c.header === 'Logged By Role'));

/* ---------------- C. Table 5 error batch ---------------- */
console.log('\n=== C. Table 5 error batch runs through the real validator ===');
const batch = buildErrorBatch();
check(`batch has ${ERROR_BATCH_SIZE} rows`, batch.length === ERROR_BATCH_SIZE);
const res = validateRows(batch);
check('validator produced errors', res.errorCount > 0);
check('validator found undated defects', res.issues.some((i) => i.defect === 'undated'));
check('validator found duplicate-id defects', res.issues.some((i) => i.defect === 'duplicate-id'));
check('validator found missing-required defects', res.issues.some((i) => i.defect === 'missing-required'));
check('all 30 malformed rows blocked', res.rejected === ERROR_BATCH_SIZE);
check('no row accepted', res.accepted === 0);
check('duplicate reported against the first occurrence', res.issues.some((i) => i.defect === 'duplicate-id' && /first seen on row/.test(i.message)));

const clean = validateRows([{
  'Record ID': 'CD-2026-000001', 'Patient ID': '0000-0001-0001', Names: 'Dela Cruz, Juan',
  Age: '34', Sex: 'Male', 'Personnel Category': 'Active military', 'Unit Branch': 'Army',
  'Surveillance Category': 'Communicable / Infectious Diseases', Condition: 'Dengue',
  'Service Type': 'OPD', 'Case Classification': 'Confirmed', 'Encounter Date': '2026-09-24',
  'Discharge Date': '', 'Reporting Facility Unit': '525th MC', 'Logged By Role': 'Nurse',
  'Outcome Status': 'Admitted',
}]);
check('a well-formed row passes with 0 errors', clean.errorCount === 0);
check('optional empty Discharge Date is not an error', clean.errorCount === 0);
check('optional bad enum only warns', validateRows([{ ...{
  'Record ID': 'CD-2026-000002', 'Patient ID': '0000-0002-0002', Names: 'X Y', Age: '30',
  Sex: 'Male', 'Personnel Category': 'Alien', 'Unit Branch': 'Army',
  'Surveillance Category': 'Communicable / Infectious Diseases', Condition: 'Dengue',
  'Service Type': 'OPD', 'Case Classification': 'Confirmed', 'Encounter Date': '2026-09-24',
  'Discharge Date': '', 'Reporting Facility Unit': '525th MC', 'Logged By Role': 'Nurse',
  'Outcome Status': 'Admitted',
} }]).warningCount === 1);

const tpl = buildTemplateCsv();
check('template header matches Table 1 order', tpl.split('\r\n')[0] === DATA_FIELDS.map((f) => f.name).join(','));
check('template has a worked example row', tpl.trim().split('\r\n').length === 2);
check('template example uses a Table 2 condition', /Dengue/.test(tpl));

/* ---------------- D. Table 4 RBAC ---------------- */
console.log('\n=== D. Table 4 RBAC matrix integrity ===');
const ORDER: Permission[] = ['demographics', 'clinicalLab', 'physicalExam', 'surveillance', 'audit'];
check('8 roles', ROLES.length === 8);
check('every role has 5 grants', ROLES.every((r) => ORDER.every((p) => !!r.grants[p])));
check('every grant has a label', ROLES.every((r) => ORDER.every((p) => !!ACCESS_LABELS[r.grants[p] as AccessLevel])));

const analyst = ROLES.find((r) => r.id === 'hseu-analyst')!;
check('analyst: full surveillance (export/configure/filter)', analyst.grants.surveillance === 'full-access');
check('analyst: view-only demographics', analyst.grants.demographics === 'view');
check('analyst: no upload rights', analyst.grants.audit === 'ingestion-errors');
const nurse = ROLES.find((r) => r.id === 'nurse')!;
check('nurse: edit/view demographics', nurse.grants.demographics === 'edit-view');
check('nurse: view-only surveillance', nurse.grants.surveillance === 'view');
check('nurse: can upload', nurse.grants.audit === 'file-upload');
const clerk = ROLES.find((r) => r.id === 'admin-clerk')!;
check('clerk: no clinical lab access', clerk.grants.clinicalLab === 'no-access');
check('clerk: no audit access', clerk.grants.audit === 'no-access');
check('clerk: still reaches Data Management via demographics', clerk.grants.demographics === 'create-edit-view');
const medtech = ROLES.find((r) => r.id === 'medtech')!;
check('medtech: no surveillance access', medtech.grants.surveillance === 'no-access');
check('medtech: can upload', medtech.grants.audit === 'file-upload');
const blocked = ROLES.filter((r) => r.grants.surveillance === 'no-access');
check('roles blocked from the dashboard are MedTech/RadTech/PT', blocked.length === 3);

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECKS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
