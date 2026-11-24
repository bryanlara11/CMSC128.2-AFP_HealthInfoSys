import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const blockedNetwork = moduleUrl('export function requireSupabase(){throw new Error("Unexpected network request")} export function databaseError(message){return new Error(message)}');
const analyticsSource = compile('../src/data/analytics.ts').replace("from './supabase'", `from ${JSON.stringify(blockedNetwork)}`);
const { trendSeries, weekContaining } = await import(moduleUrl(analyticsSource));
const exportSource = compile('../src/data/export.ts').replace("from 'xlsx'", `from ${JSON.stringify(pathToFileURL(require.resolve('xlsx')).href)}`);
const { summaryCsv } = await import(moduleUrl(exportSource));

test('trend series preserves uploaded disease names and fills sparse reporting weeks', () => {
  const result = trendSeries({ byDisease: [{ name: 'Disease.With.Dot', count: 3 }, { name: 'Other', count: 2 }], trend: [
    { period: '2026-10-12', disease: 'Other', count: 2 }, { period: '2026-10-05', disease: 'Disease.With.Dot', count: 3 },
  ] });
  assert.deepEqual(result.names, ['Disease.With.Dot', 'Other']);
  assert.deepEqual(result.rows, [
    { period: '2026-10-05', series_0: 3, series_1: 0 }, { period: '2026-10-12', series_0: 0, series_1: 2 },
  ]);
});

test('daily trends fill every day in the selected range; weekly trends fill missing weeks', () => {
  const daily = trendSeries({ trendInterval: 'day', byDisease: [{ name: 'A', count: 3 }], trend: [
    { period: '2026-05-26', disease: 'A', count: 1 }, { period: '2026-05-29', disease: 'A', count: 2 },
  ] }, { from: '2026-05-25', to: '2026-05-31' });
  assert.equal(daily.interval, 'day');
  assert.deepEqual(daily.rows.map(row => row.period), ['2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', '2026-05-31']);
  assert.deepEqual(daily.rows.map(row => row.series_0), [0, 1, 0, 0, 2, 0, 0]);
  const weekly = trendSeries({ byDisease: [{ name: 'A', count: 2 }], trend: [
    { period: '2026-05-04', disease: 'A', count: 1 }, { period: '2026-05-25', disease: 'A', count: 1 },
  ] });
  assert.deepEqual(weekly.rows.map(row => row.period), ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']);
});

test('default range is the Monday-to-Sunday week containing the latest report date', () => {
  assert.deepEqual(weekContaining('2026-05-31'), { from: '2026-05-25', to: '2026-05-31' });
  assert.deepEqual(weekContaining('2026-05-25'), { from: '2026-05-25', to: '2026-05-31' });
  assert.deepEqual(weekContaining('2026-01-01'), { from: '2025-12-29', to: '2026-01-04' });
});

test('summary CSV uses aggregate columns and protects spreadsheet cells from formula execution', () => {
  const result = summaryCsv([{ 'Reporting Week': '2026-10-12', Disease: '=HYPERLINK("https://example.test")',
    Province: 'CEBU, PH', 'Assigned Unit': 'Unit A', 'Reporting Unit': 'ER', Classification: 'CONFIRMED', Sex: 'M', 'Age Band': '30-34', Cases: 3,
    SURNAME: 'PrivatePatientName', 'CASE ID': 'PRIVATE-001',
  }]);
  assert.ok(!result.includes('PrivatePatientName') && !result.includes('PRIVATE-001'));
  assert.ok(!result.split('\r\n')[0].includes('SURNAME'));
  assert.ok(result.includes("'=HYPERLINK"));
  assert.ok(result.includes('"CEBU, PH"'));
  assert.ok(result.endsWith(',3'));
});
