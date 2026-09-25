import {
  DATA_FIELDS, SURVEILLANCE_CATEGORIES, CONDITIONS, ROLES, PERMISSION_LABELS,
  ACCESS_LABELS, DASHBOARD_METRICS, PILOT_SAMPLING, PILOT_TOTAL,
  CASE_CLASSIFICATIONS, SERVICE_TYPES, PERSONNEL_CATEGORIES, UNIT_BRANCHES, OUTCOME_STATUSES,
} from './dictionary';

let failed = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
};
const has = (n: string) => DATA_FIELDS.some((f) => f.name === n);

console.log('=== Table 1. Temporal Data — all 15 documented fields present ===');
for (const f of [
  'Record ID', 'Patient ID', 'Names',
  'Age', 'Sex', 'Personnel Category', 'Unit Branch',
  'Surveillance Category', 'Condition',
  'Service Type', 'Case Classification', 'Encounter Date', 'Discharge Date',
  'Reporting Facility Unit', 'Logged By Role', 'Outcome Status',
]) check(`field "${f}"`, has(f));
check('Patient ID noted as 12-digit synthetic', DATA_FIELDS.find((f) => f.name === 'Patient ID')?.note?.includes('12-digit') ?? false);
check('Record ID noted as dummy transaction ID', DATA_FIELDS.find((f) => f.name === 'Record ID')?.note?.includes('Dummy Transaction ID') ?? false);
check('optional fields flagged (Personnel Category)', DATA_FIELDS.find((f) => f.name === 'Personnel Category')?.required === false);
check('optional fields flagged (Unit Branch)', DATA_FIELDS.find((f) => f.name === 'Unit Branch')?.required === false);
check('optional fields flagged (Case Classification)', DATA_FIELDS.find((f) => f.name === 'Case Classification')?.required === false);
check('5 field groups defined', new Set(DATA_FIELDS.map((f) => f.group)).size === 5);

console.log('\n=== Table 2. Standardized Categorization — 6 categories ===');
check('6 categories', SURVEILLANCE_CATEGORIES.length === 6);
const LABEL = {
  communicable: 'Communicable / Infectious Diseases',
  orthopedic: 'Orthopedic & Rehabilitation',
  non_comm: 'Non-Communicable / Lifestyle Diseases',
  mental: 'Mental Health & Psychological Wellness',
  womens: "Women's Health & OB-GYN",
  mortality: 'Mortalities & Severe Casualties',
};
for (const [id, label] of Object.entries(LABEL)) {
  check(`category "${label}"`, SURVEILLANCE_CATEGORIES.some((c) => c.label === label || c.id.startsWith(id.split('_')[0])));
}
for (const c of ['Influenza', 'Dengue', 'Pneumonia', 'UTI', 'Leptospirosis', 'Acute Gastroenteritis']) {
  check(`communicable condition "${c}"`, CONDITIONS.includes(c));
}
for (const c of ['Hypertension', 'Diabetes', 'Heart Failure', 'Gout']) check(`NCD condition "${c}"`, CONDITIONS.includes(c));
for (const c of ['ACL Tear', 'Meniscal Tear', 'Osteoarthritis', 'Combat/Training Injuries', 'Fractures']) {
  check(`orthopedic condition "${c}"`, CONDITIONS.includes(c));
}
for (const c of ['MDD', 'GAD', 'PTSD']) check(`mental health condition "${c}"`, CONDITIONS.includes(c));
check('pilot scope = communicable + orthopedic only', SURVEILLANCE_CATEGORIES.filter((c) => c.inPilotScope).length === 2);
check('incidence metric on communicable', SURVEILLANCE_CATEGORIES[0].metric.includes('Incidence rate'));
check('prevalence metric on NCD', SURVEILLANCE_CATEGORIES.find((c) => c.id === 'non-communicable')?.metric === 'Prevalence rate');

console.log('\n=== Controlled vocabularies match spec ===');
check('Service Type = OPD, Emergency, Deployment, CDD', ['OPD', 'Emergency', 'Deployment', 'CDD'].every((v) => SERVICE_TYPES.includes(v as never)));
check('Case Classification = Suspected/Probable/Confirmed', ['Suspected', 'Probable', 'Confirmed'].every((v) => CASE_CLASSIFICATIONS.includes(v as never)));
check('Personnel Category = 3 values', PERSONNEL_CATEGORIES.length === 3);
check('Unit Branch = Army/Navy/AF/Civilian/Reservist', UNIT_BRANCHES.length === 5 && UNIT_BRANCHES.includes('Reservist'));
check('Outcome Status includes Recovered + Admitted', OUTCOME_STATUSES.includes('Recovered') && OUTCOME_STATUSES.includes('Admitted'));

console.log('\n=== Table 3. Dashboard results ===');
check('4 metrics', DASHBOARD_METRICS.length === 4);
check('Surveillance Category', DASHBOARD_METRICS[0].label === 'Surveillance Category');
check('Condition / Diagnosis', DASHBOARD_METRICS[1].label === 'Condition / Diagnosis');
check('Active / New Cases (Week)', DASHBOARD_METRICS[2].label === 'Active / New Cases (Week)');
check('Percent Change (%)', DASHBOARD_METRICS[3].label === 'Percent Change (%)');

console.log('\n=== Table 4. RBAC — 8 roles x 5 permission columns ===');
check('8 roles', ROLES.length === 8);
for (const l of ['Admin / Information Clerk', 'Medical Technologist', 'Radiologic Technologist', 'Physical Therapist', 'Nurse', 'Medical Officer (Doctor)', 'HSEU Epidemiologist / Analyst', 'I.T. Personnel']) {
  check(`role "${l}"`, ROLES.some((r) => r.label === l));
}
check('5 permission columns', Object.keys(PERMISSION_LABELS).length === 5);
check('every role grants all 5 permissions', ROLES.every((r) => Object.keys(r.grants).length === 5));
check('Admin Clerk has no clinical lab access', ROLES[0].grants.clinicalLab === 'no-access');
check('MedTech cannot view surveillance', ROLES.find((r) => r.id === 'medtech')?.grants.surveillance === 'no-access');
check('Nurse can edit demographics', ROLES.find((r) => r.id === 'nurse')?.grants.demographics === 'edit-view');
check('Analyst has full surveillance access', ROLES.find((r) => r.id === 'hseu-analyst')?.grants.surveillance === 'full-access');
check('Analyst is view-only on demographics', ROLES.find((r) => r.id === 'hseu-analyst')?.grants.demographics === 'view');
check('every access level has a label', ROLES.every((r) => Object.values(r.grants).every((g) => !!ACCESS_LABELS[g])));

console.log('\n=== Table 5. Pilot testing sampling ===');
check('4 sampling targets', PILOT_SAMPLING.length === 4);
check('Deployment Health Clearance 20-30', PILOT_SAMPLING.some((p) => p.group.includes('Deployment') && p.target.includes('20')));
check('Communicable 30-50', PILOT_SAMPLING.some((p) => p.group.includes('Communicable') && p.target.includes('30')));
check('Error Batch = 30 malformed', PILOT_SAMPLING.some((p) => p.group === 'Error Batch' && p.target.includes('30')));
check('error cases: undated, duplicate IDs, required cols', /Undated/.test(PILOT_SAMPLING[3].dataType) && /duplicate/.test(PILOT_SAMPLING[3].dataType));
check('APE marked out of scope', PILOT_SAMPLING.find((p) => p.group.includes('APE'))?.inScope === false);
check('~100 records total', PILOT_TOTAL === '~100 records');

console.log(`\n${failed === 0 ? 'ALL COMPLIANCE CHECKS PASSED' : failed + ' CHECKS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
