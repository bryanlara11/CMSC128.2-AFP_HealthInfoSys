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
const { trendSeries } = await import(moduleUrl(analyticsSource));
const exportSource = compile('../src/data/export.ts').replace("from 'xlsx'", `from ${JSON.stringify(pathToFileURL(require.resolve('xlsx')).href)}`);
const { summaryCsv } = await import(moduleUrl(exportSource));

test('trend series preserves uploaded disease names and fills sparse reporting weeks', () => {
  const result = trendSeries({ byDisease: [{ name: 'Disease.With.Dot', count: 3 }, { name: 'Other', count: 2 }], trend: [
    { week: '2026-10-12', disease: 'Other', count: 2 }, { week: '2026-10-05', disease: 'Disease.With.Dot', count: 3 },
  ] });
  assert.deepEqual(result.names, ['Disease.With.Dot', 'Other']);
  assert.deepEqual(result.rows, [
    { week: '2026-10-05', series_0: 3, series_1: 0 }, { week: '2026-10-12', series_0: 0, series_1: 2 },
  ]);
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
