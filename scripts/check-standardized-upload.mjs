import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { parseExcelFile } from './lib/browser-excel.mjs';
import { UPLOAD_HEADERS, validateWorkbook, dataSheets, sheetTable } from '../shared/standardizedWorkbook.js';

const goodRow = ['26-001', '2026-10-25', 'ER', 'SSG', 'PA', 'Example', 'Test', 'Q', 'M', '30', 'Dengue', 'PROBABLE', '2026-10-24', 'CEBU'];
const sheet = (rows, name = 'Surveillance_Data') => ({ name, rows, rowCount: rows.length, columnCount: Math.max(0, ...rows.map(r => r.length)) });
const workbook = (...sheets) => ({ filename: 'test.xlsx', sheets });

test('checks all fourteen values, including middle name; preserves zero and false', () => {
  assert.equal(validateWorkbook(workbook(sheet([UPLOAD_HEADERS, goodRow]))).status, 'complete');
  for (let i = 0; i < 14; i++) {
    const row = [...goodRow]; row[i] = i % 2 ? '  ' : null;
    const result = validateWorkbook(workbook(sheet([UPLOAD_HEADERS, row])));
    assert.equal(result.status, 'incomplete', UPLOAD_HEADERS[i]);
    assert.equal(result.missingCount, 1);
  }
  const row = [...goodRow]; row[9] = 0; row[8] = false;
  assert.equal(validateWorkbook(workbook(sheet([UPLOAD_HEADERS, row]))).status, 'complete');
});

test('keeps interior empty rows and ignores trailing blank template rows', () => {
  const blank = Array(14).fill(null);
  const result = validateWorkbook(workbook(sheet([UPLOAD_HEADERS, goodRow, blank, goodRow, blank, blank])));
  assert.equal(result.status, 'incomplete');
  assert.equal(result.recordCount, 3);
  assert.equal(result.missingCount, 14);
  assert.equal(validateWorkbook(workbook(sheet([UPLOAD_HEADERS, blank]))).status, 'incomplete');
});

test('rejects missing, extra, reordered, duplicate and obsolete headers with explanations', () => {
  for (const headers of [
    UPLOAD_HEADERS.slice(0, 13), [...UPLOAD_HEADERS, 'EXTRA'],
    [...UPLOAD_HEADERS].reverse(), UPLOAD_HEADERS.map((h, i) => i === 1 ? 'CASE ID' : h),
    ['Case_ID', 'Date_Reported', 'Disease', 'Reporting_Unit', 'Sex', 'Age_Group', 'Case_Classification'],
  ]) {
    const result = validateWorkbook(workbook(sheet([headers])));
    assert.equal(result.status, 'error');
    assert.ok(result.reasons.length);
  }
  const padded = [UPLOAD_HEADERS.map(h => ` ${h.toLowerCase()} `).concat(null), goodRow.concat(null)];
  assert.equal(validateWorkbook(workbook(sheet(padded))).status, 'complete');
});

test('ignores workbook reference sheets and gives column errors precedence across sheets', () => {
  const data = sheet([UPLOAD_HEADERS, goodRow]);
  const reference = sheet([['PROVINCES'], ['CEBU']], 'Ref_Provinces');
  const result = validateWorkbook(workbook(data, reference, sheet([['Philippine Provinces']], 'Province Lists')));
  assert.equal(result.status, 'complete');
  assert.equal(result.recordCount, 1);
  assert.equal(validateWorkbook(workbook(data, sheet([['Wrong', 'Columns']]))).status, 'error');
  assert.equal(validateWorkbook(workbook(reference)).status, 'error');
});

test('accepts every finalized sample and excludes its lookup sheets', async () => {
  for (const filename of readdirSync(new URL('../sample-data/samples/', import.meta.url))) {
    if (!filename.endsWith('.xlsx')) continue;
    const parsed = await parseExcelFile(new File([readFileSync(new URL(`../sample-data/samples/${filename}`, import.meta.url))], filename));
    const result = validateWorkbook(parsed);
    assert.notEqual(result.status, 'error', `${filename}: ${result.reasons.join(' ')}`);
    if (result.recordCount === 0) {
      assert.equal(result.recordCount, 0, 'Unused template rows must not create records');
      assert.equal(result.status, 'incomplete');
    } else assert.ok(result.recordCount > 0, filename);
    assert.ok(dataSheets(parsed).every(s => s.columnCount === 14));
    if (filename === 'Mock-Data-Masterlist.xlsx') assert.equal(result.recordCount, 2163);
  }
});

test('reads masterlist titles above the actual headers and preserves Excel row numbers', async () => {
  const parsed = await parseExcelFile(new File([readFileSync(new URL('../sample-data/samples/Mock-Data-Masterlist.xlsx', import.meta.url))], 'Mock-Data-Masterlist.xlsx'));
  const table = sheetTable(parsed.sheets[0]);
  assert.equal(table.headerIndex, 3);
  assert.equal(table.rows[0].excelRow, 5);
  assert.deepEqual(table.headers, UPLOAD_HEADERS);
});
