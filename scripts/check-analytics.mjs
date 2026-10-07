import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const workbookUrl = moduleUrl(compile('../src/data/workbook.ts'));
const { dateRange, validDate, localToday, importedRecords, filterRecords, caseCounts, summary, diseaseTrends } = await import(
  moduleUrl(compile('../src/data/analytics.ts').replaceAll("'./workbook'", JSON.stringify(workbookUrl)))
);

const headers = ['Case_ID', 'Date_Reported', 'Disease', 'Reporting_Unit', 'Sex', 'Age_Group', 'Case_Classification'];
const caseRow = (id, date, disease = 'Dengue', unit = 'Unit A', sex = 'Female', age = '18-29') => [id, date, disease, unit, sex, age, 'Confirmed'];
function upload(id, rows, importedAt = '2026-10-08T00:00:00.000Z') {
  const matrix = [['Workbook title', ...Array(6).fill(null)], ['Synthetic workbook', ...Array(6).fill(null)], Array(7).fill(null), headers, ...rows];
  return {
    id, dateImported: importedAt, importedBy: 'I.T. Personnel',
    workbook: { filename: `${id}.xlsx`, sheets: [
      { name: 'Mock Upload', columnCount: 7, rowCount: matrix.length, rows: matrix },
      { name: 'How It Works', columnCount: 2, rowCount: 2, rows: [['Step', 'Workflow'], ['1', 'Upload']] },
    ] },
  };
}
const fixtures = [upload('fixture', [
  caseRow('C1', '2026-10-08'),
  caseRow('C2', '2026-10-02', 'Dengue', 'Unit B', 'M', '60+'),
  caseRow('C3', '2026-10-01', 'Influenza'),
  caseRow('C4', '2026-09-30', 'Influenza', 'Unit B'),
  caseRow('C5', '2026-09-01', 'Dengue'),
  caseRow('FUTURE', '2026-10-09'),
])];
const custom = { start: '2026-09-01', end: '2026-10-08' };

test('date presets use exact inclusive calendar boundaries', () => {
  assert.deepEqual(dateRange('last7', '2026-10-08', custom), { start: '2026-10-02', end: '2026-10-08' });
  assert.deepEqual(dateRange('last14', '2026-10-08', custom), { start: '2026-09-25', end: '2026-10-08' });
  assert.deepEqual(dateRange('thisMonth', '2026-10-08', custom), { start: '2026-10-01', end: '2026-10-08' });
  assert.deepEqual(dateRange('lastMonth', '2026-10-08', custom), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(dateRange('lastMonth', '2026-01-01', custom), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(dateRange('lastMonth', '2024-03-10', custom), { start: '2024-02-01', end: '2024-02-29' });
  assert.equal(localToday(new Date(2026, 9, 8, 0, 1)), '2026-10-08');
});

test('custom ranges reject missing, impossible, and reversed dates; a single day is valid', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2024-02-29'), true);
  for (const invalid of [
    { start: '', end: '2026-10-08' },
    { start: '2026-10-09', end: '2026-10-08' },
    { start: '2026-02-30', end: '2026-10-08' },
  ]) assert.equal(dateRange('custom', '2026-10-08', invalid), null);
  const sameDay = { start: '2026-10-08', end: '2026-10-08' };
  assert.deepEqual(dateRange('custom', '2026-10-08', sameDay), sameDay);
});

test('normalizes workbook headers and ignores preambles and the instructional sheet', () => {
  const parsed = importedRecords(fixtures);
  assert.equal(parsed.records.length, 6);
  assert.equal(parsed.unsupportedSheets, 0);
  assert.equal(parsed.records.find((record) => record.caseId === 'C2').sex, 'Male');
  assert.equal(parsed.records.find((record) => record.caseId === 'C1').ageGroup, '18–29');
  assert.equal(parsed.records[0].date, '2026-10-09');
  assert.equal(parsed.records[0].source, 'fixture.xlsx');
});

test('all graphs and rows filter on report date rather than upload date', () => {
  const { records } = importedRecords(fixtures);
  const expected = { last7: 2, last14: 4, thisMonth: 3, lastMonth: 2, custom: 5 };
  for (const [preset, count] of Object.entries(expected)) {
    const range = dateRange(preset, '2026-10-08', custom);
    assert.equal(filterRecords(records, range).length, count, preset);
  }
  assert.equal(filterRecords(records, dateRange('last7', '2026-10-08', custom), 'Influenza').length, 0);
  assert.equal(filterRecords(records, null).length, 0);
  assert.equal(filterRecords(records, { start: '2026-10-08', end: '2026-10-08' }).length, 1);
});

test('summaries and disease, age, and sex counts agree with filtered records', () => {
  const { records } = importedRecords(fixtures);
  const visible = filterRecords(records, dateRange('last7', '2026-10-08', custom));
  assert.deepEqual(summary(visible), { total: 2, leaders: [{ name: 'Dengue', cases: 2 }], units: 2 });
  assert.deepEqual(caseCounts(visible, 'ageGroup'), [{ name: '18–29', cases: 1 }, { name: '60+', cases: 1 }]);
  for (const field of ['disease', 'ageGroup', 'sex']) assert.equal(caseCounts(visible, field).reduce((total, item) => total + item.cases, 0), visible.length);
  assert.deepEqual(summary([]), { total: 0, leaders: [], units: 0 });
  const tied = summary(filterRecords(records, { start: '2026-09-01', end: '2026-09-30' }));
  assert.deepEqual(tied.leaders, [{ name: 'Dengue', cases: 1 }, { name: 'Influenza', cases: 1 }]);
});

test('daily trends include zero-count dates and exactly match case totals', () => {
  const { records } = importedRecords(fixtures);
  const range = dateRange('last7', '2026-10-08', custom);
  const trend = diseaseTrends(filterRecords(records, range), range);
  assert.equal(trend.interval, 'day');
  assert.equal(trend.rows.length, 7);
  assert.equal(trend.rows[0].date, '2026-10-02');
  assert.equal(trend.rows[6].date, '2026-10-08');
  assert.equal(trend.rows[1].d0, 0);
  assert.equal(trend.rows.reduce((total, row) => total + row.d0, 0), 2);
});

test('repeated case IDs use the newest uploaded record; invalid dates do not enter analytics', () => {
  const latest = upload('new', [caseRow('C1', '2026-10-07', 'Pneumonia'), caseRow('BAD', '2026-02-30')], '2026-10-09T00:00:00.000Z');
  const parsed = importedRecords([...fixtures, latest]);
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.invalidDates, 1);
  assert.equal(parsed.records.find((record) => record.caseId === 'C1').disease, 'Pneumonia');
  assert.equal(parsed.records.length, 6);
});

test('weekly and monthly ranges include both boundary dates without losing cases', () => {
  const cases = importedRecords([upload('long', [caseRow('A', '2025-01-15'), caseRow('B', '2026-12-31')])]).records;
  const monthly = diseaseTrends(cases, { start: '2025-01-15', end: '2026-12-31' });
  assert.equal(monthly.interval, 'month');
  assert.equal(monthly.rows.length, 24);
  assert.equal(monthly.rows[0].date, '2025-01-15');
  assert.equal(monthly.rows[23].end, '2026-12-31');
  assert.equal(monthly.rows.reduce((total, row) => total + row.d0, 0), 2);
  const weeklyCases = importedRecords([upload('weekly', [caseRow('A', '2026-01-01'), caseRow('B', '2026-03-31')])]).records;
  const weekly = diseaseTrends(weeklyCases, { start: '2026-01-01', end: '2026-03-31' });
  assert.equal(weekly.interval, 'week');
  assert.equal(weekly.rows.reduce((total, row) => total + row.d0, 0), 2);
});

test('supports Table 1 column aliases, derived age bands, unspecified fields and unsupported sheets', () => {
  const entry = upload('aliases', []);
  entry.workbook.sheets = [{
    name: 'Records', rowCount: 4, columnCount: 6,
    rows: [
      ['Record ID', 'Encounter Date', 'Condition', 'Reporting Facility Unit', 'Sex', 'Age'],
      ['A', '2026-10-08', 'Dengue', 'Unit A', 'F', 0],
      ['B', '2026-10-08', 'dengue', 'unit a', null, 60],
      ['C', '2026-10-08', 'Influenza', null, null, null],
    ],
  }, { name: 'Notes', rowCount: 1, columnCount: 1, rows: [['Note']] }];
  const parsed = importedRecords([entry]);
  assert.equal(parsed.unsupportedSheets, 1);
  assert.equal(summary(parsed.records).units, 1);
  assert.equal(caseCounts(parsed.records, 'disease').length, 2);
  assert.deepEqual(caseCounts(parsed.records, 'ageGroup').map((item) => item.name), ['0–17', '60+', 'Not specified']);
});
