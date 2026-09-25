/**
 * Generates the sample workbooks used to demo ingestion.
 *
 *   npm run make:samples
 *
 * Writes to sample-data/:
 *   AFP_HSEU_Template.xlsx              Table 1 headers + one worked example row
 *   AFP_HSEU_Valid_Sample_50.xlsx       50 conforming records
 *   AFP_HSEU_Malformed_Sample_30.xlsx   30 defective records (Table 5 error batch)
 *
 * The valid file is sized to the Table 5 "Communicable Disease Surveillance"
 * target of 30-50 records; the malformed file is the "Error Batch" target.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'sample-data');

/* ---- Table 1 headers, in dictionary order ---- */
const HEADERS = [
  'Record ID', 'Patient ID', 'Names', 'Age', 'Sex', 'Personnel Category',
  'Unit Branch', 'Surveillance Category', 'Condition', 'Service Type',
  'Case Classification', 'Encounter Date', 'Discharge Date',
  'Reporting Facility Unit', 'Logged By Role', 'Outcome Status',
];

const COMMUNICABLE = 'Communicable / Infectious Diseases';
const ORTHO = 'Orthopedic & Rehabilitation';

const CONDITIONS = [
  { c: 'Dengue', cat: COMMUNICABLE },
  { c: 'Influenza', cat: COMMUNICABLE },
  { c: 'Pneumonia', cat: COMMUNICABLE },
  { c: 'Leptospirosis', cat: COMMUNICABLE },
  { c: 'Acute Gastroenteritis', cat: COMMUNICABLE },
  { c: 'UTI', cat: COMMUNICABLE },
  { c: 'ACL Tear', cat: ORTHO },
  { c: 'Combat/Training Injuries', cat: ORTHO },
  { c: 'Fractures', cat: ORTHO },
];

const SURNAMES = ['Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Aquino'];
const FIRST_M = ['Juan', 'Pedro', 'Miguel', 'Andres', 'Carlo', 'Ramon'];
const FIRST_F = ['Maria', 'Ana', 'Rosa', 'Cristina', 'Luisa', 'Divina'];
const UNITS = ['525th MC', '3rd MC', '11th MC', '7th MC', '21st MC', '2nd MC', '14th MC', 'Hospital MABINI'];
const PERSONNEL = ['Active military', 'Civilian employee', 'Dependent'];
const BRANCHES = ['Army', 'Navy', 'Air Force', 'Civilian', 'Reservist'];
const SERVICES = ['OPD', 'Emergency', 'CDD', 'Deployment', 'Inpatient'];
const CLASSES = ['Confirmed', 'Probable', 'Suspected'];
const ROLES = ['Doctor', 'Medical Technologist', 'Radiologic Technologist', 'Nurse', 'Physical Therapist'];
const OUTCOMES = ['Recovered', 'Admitted', 'Under Observation', 'Referred'];

/* Deterministic PRNG so regenerating produces identical files. */
let seed = 20260924;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const pad = (n, w) => String(n).padStart(w, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (base, n) => new Date(base.getTime() + n * 86400000);

function makeValid(i) {
  const male = rnd() > 0.5;
  const { c, cat } = pick(CONDITIONS);
  const enc = addDays(new Date('2026-09-24T00:00:00Z'), -(Math.floor(rnd() * 27) + 1));
  return {
    'Record ID': `CD-2026-${pad(1000 + i, 6)}`,
    'Patient ID': `0000-${pad(1000 + i, 4)}-${pad(1000 + Math.floor(rnd() * 9000), 4)}`,
    Names: `${male ? pick(FIRST_M) : pick(FIRST_F)} ${pick(SURNAMES)}`,
    Age: Math.floor(rnd() * 60) + 19,
    Sex: male ? 'Male' : 'Female',
    'Personnel Category': pick(PERSONNEL),
    'Unit Branch': pick(BRANCHES),
    'Surveillance Category': cat,
    Condition: c,
    'Service Type': pick(SERVICES),
    'Case Classification': pick(CLASSES),
    'Encounter Date': iso(enc),
    'Discharge Date': rnd() > 0.2 ? iso(addDays(enc, Math.floor(rnd() * 6) + 1)) : '',
    'Reporting Facility Unit': pick(UNITS),
    'Logged By Role': pick(ROLES),
    'Outcome Status': pick(OUTCOMES),
  };
}

function write(name, rows, extraSheet) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');
  if (extraSheet) XLSX.utils.book_append_sheet(wb, extraSheet, 'Instructions');
  XLSX.writeFile(wb, path.join(OUT, name));
  return rows.length;
}

fs.mkdirSync(OUT, { recursive: true });

/* 1. Template: headers + one worked example */
const example = makeValid(0);
const tplRows = [example];
const tplCount = write('AFP_HSEU_Template.xlsx', tplRows, XLSX.utils.aoa_to_sheet([
  ['AFP Health Information System — standardized upload template'],
  ['Source: [HI_CMSC] Overview.pdf, Table 1 (Temporal Data)'],
  [''],
  ['Rules'],
  ['1. Do not rename, reorder or remove columns.'],
  ['2. Encounter Date and Discharge Date must be YYYY-MM-DD.'],
  ['3. Record ID must be unique.'],
  ['4. Patient ID must be 12 digits in 0000-0000-0000 form (synthetic only).'],
  ['5. Condition must come from the Table 2 category list.'],
  ['6. Optional fields (Personnel Category, Unit Branch, Case Classification, Discharge Date) may be blank.'],
]));

/* 2. Valid sample: 50 rows, inside the Table 5 target of 30-50 */
const valid = Array.from({ length: 50 }, (_, i) => makeValid(i));
const validCount = write('AFP_HSEU_Valid_Sample_50.xlsx', valid, XLSX.utils.aoa_to_sheet([
  ['50 conforming records. Expected result: accepted with 0 errors.'],
  ['Table 5 target: Communicable Disease Surveillance, 30-50 records.'],
]));

/* 3. Malformed sample: 30 rows across the three Table 5 defect classes */
const bad = [];
for (let i = 0; i < 30; i++) {
  const row = { ...makeValid(200 + i) };
  if (i < 10) {
    // Defect 1 — undated. Blank on even rows, non-ISO text on odd.
    row['Encounter Date'] = i % 2 === 0 ? '' : '09/24/2026';
  } else if (i < 20) {
    // Defect 2 — duplicate Record ID. Must reuse an ID that already appeared
    // earlier in the sheet, otherwise the first copy is legitimately unique.
    row['Record ID'] = bad[0]['Record ID'];
  } else {
    // Defect 3 — missing required columns. Guarantee at least one removal.
    const drop = ['Condition', 'Service Type', 'Reporting Facility Unit'][(i - 20) % 3];
    delete row[drop];
    if (i % 2 === 0) delete row['Outcome Status'];
  }
  bad.push(row);
}

/* Self-check: the Instructions sheet promises all 30 rows are rejected, so fail
   loudly here rather than shipping a file that quietly disagrees. */
const seenIds = new Set();
let clean = 0;
for (const row of bad) {
  const id = row['Record ID'];
  const dupe = seenIds.has(id);
  seenIds.add(id);
  const missing = ['Record ID', 'Condition', 'Service Type', 'Outcome Status', 'Reporting Facility Unit']
    .some((f) => !row[f]);
  const badDate = !row['Encounter Date'] || !/^\d{4}-\d{2}-\d{2}$/.test(row['Encounter Date']);
  if (!dupe && !missing && !badDate) clean++;
}
if (clean > 0) {
  throw new Error(`Malformed sample has ${clean} row(s) with no defect; expected all 30 rejected.`);
}

const badCount = write('AFP_HSEU_Malformed_Sample_30.xlsx', bad, XLSX.utils.aoa_to_sheet([
  ['30 deliberately defective records. Expected result: every row rejected.'],
  ['Defect classes: rows 1-10 undated, 11-20 duplicate Record ID, 21-30 missing required columns.'],
  ['Table 5 target: Error Batch, 30 malformed records.'],
]));

console.log('Wrote to sample-data/:');
console.log(`  AFP_HSEU_Template.xlsx              ${tplCount} example row`);
console.log(`  AFP_HSEU_Valid_Sample_50.xlsx       ${validCount} records (expect 0 errors)`);
console.log(`  AFP_HSEU_Malformed_Sample_30.xlsx   ${badCount} records (expect all rejected)`);
