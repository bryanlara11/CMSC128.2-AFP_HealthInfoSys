/**
 * Verifies the generated sample workbooks against the real validator.
 * Run: npm run check:samples  (after npm run make:samples)
 */

import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { validateRows } from './pipeline';
import { DATA_FIELDS, CONDITIONS } from './dictionary';

let failed = 0;
const check = (l: string, ok: boolean, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${extra ? ` — ${extra}` : ''}`);
};

const DIR = path.resolve(process.cwd(), 'sample-data');
const FILES = {
  template: 'AFP_HSEU_Template.xlsx',
  valid: 'AFP_HSEU_Valid_Sample_50.xlsx',
  malformed: 'AFP_HSEU_Malformed_Sample_30.xlsx',
};

const HEADERS = DATA_FIELDS.map((f) => f.name);

function load(file: string) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) throw new Error(`Missing ${file}. Run: npm run make:samples`);
  const buf = fs.readFileSync(p);
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const headerRow = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as unknown[]).map((h) => String(h).trim());
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
  return { bytes: buf.length, isZip: buf[0] === 0x50 && buf[1] === 0x4b, headerRow, rows, sheets: wb.SheetNames };
}

console.log('=== files are real xlsx containers ===');
const tpl = load(FILES.template);
const valid = load(FILES.valid);
const malformed = load(FILES.malformed);
for (const [name, f] of Object.entries({ template: tpl, valid, malformed })) {
  check(`${name} is a zip/xlsx`, f.isZip);
  check(`${name} non-trivial size`, f.bytes > 3000, `${(f.bytes / 1024).toFixed(1)} kB`);
  check(`${name} has Instructions sheet`, f.sheets.includes('Instructions'), f.sheets.join(', '));
}

console.log('\n=== headers match Table 1 exactly, in order ===');
for (const [name, f] of Object.entries({ template: tpl, valid, malformed })) {
  check(`${name} headers match`, JSON.stringify(f.headerRow) === JSON.stringify(HEADERS));
}

console.log('\n=== row counts match the stated targets ===');
check('template has 1 example row', tpl.rows.length === 1, `${tpl.rows.length}`);
check('valid sample has 50 rows (Table 5: 30-50)', valid.rows.length === 50, `${valid.rows.length}`);
check('malformed sample has 30 rows (Table 5: error batch)', malformed.rows.length === 30, `${malformed.rows.length}`);

console.log('\n=== valid sample passes the real validator ===');
const v = validateRows(valid.rows);
check('0 errors', v.errorCount === 0, `${v.errorCount} errors, ${v.warningCount} warnings`);
check('all 50 accepted', v.accepted === 50, `accepted ${v.accepted}`);
if (v.errorCount > 0) {
  for (const i of v.issues.slice(0, 5)) console.log(`        row ${i.row} ${i.field}: ${i.message}`);
}

console.log('\n=== malformed sample is rejected on all three defect classes ===');
const m = validateRows(malformed.rows);
check('every row rejected', m.rejected === 30, `rejected ${m.rejected}/30`);
check('nothing accepted', m.accepted === 0, `accepted ${m.accepted}`);
check('undated detected', m.issues.some((i) => i.defect === 'undated'));
check('duplicate-id detected', m.issues.some((i) => i.defect === 'duplicate-id'));
check('missing-required detected', m.issues.some((i) => i.defect === 'missing-required'));

console.log('\n=== Table 2 vocabulary only ===');
const all = JSON.stringify([valid.rows, malformed.rows]);
for (const bad of ['COVID', 'Typhoid', 'Measles', 'Malaria', 'ARI']) {
  check(`no "${bad}"`, !all.includes(bad));
}
const conds = Array.from(new Set([...valid.rows, ...malformed.rows].map((r) => r.Condition).filter(Boolean)));
check('all conditions are Table 2 conditions', conds.every((c) => CONDITIONS.includes(c as never)), conds.join(', '));

console.log(`\n${failed === 0 ? 'ALL SAMPLE CHECKS PASSED' : failed + ' CHECKS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
