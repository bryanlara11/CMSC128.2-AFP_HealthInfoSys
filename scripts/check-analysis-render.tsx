import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../src/data/auth';
import { AnalysisExportPage } from '../src/pages/AnalysisExportPage';

const html = renderToStaticMarkup(<AuthProvider><AnalysisExportPage /></AuthProvider>);
for (const label of ['Total Cases', 'Most Common Disease', 'Affected Units', 'Cases by Disease', 'Cases by Age Group', 'Cases by Sex', 'Cases by Location', 'Disease Trends Over Time', 'Filtered View Records']) {
  assert.ok(html.includes(label), `Expected ${label}`);
}
assert.ok(html.includes('value="last7" selected=""'), 'Past 7 Days is selected by default');
assert.ok(html.includes('Custom Range'));
assert.ok(html.includes('Upload a standardized Excel file'));
assert.ok(html.includes('Placeholder'));
assert.ok(!html.includes('4691'), 'Previous disease fixture totals are removed');
assert.ok(!html.includes('CD-2026-001245'), 'Previous record fixtures are removed');
console.log('Analysis page render passed: default filters, summaries, five charts, record table, and empty state.');
