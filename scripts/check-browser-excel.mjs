import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { parseExcelFile } from './lib/browser-excel.mjs';

test('browser parser reads all finalized files without an upload server', async () => {
  for (const filename of readdirSync(new URL('../sample-data/samples/', import.meta.url))) {
    if (!filename.endsWith('.xlsx')) continue;
    const bytes = readFileSync(new URL(`../sample-data/samples/${filename}`, import.meta.url));
    const result = await parseExcelFile(new File([bytes], filename));
    assert.equal(result.filename, filename);
    assert.notEqual(result.validation.status, 'error', filename);
    if (filename === 'Mock-Data-Masterlist.xlsx') assert.equal(result.validation.recordCount, 2163);
  }
});

test('browser parser rejects fake and oversized workbooks, wrong extensions and cancellation', async () => {
  await assert.rejects(parseExcelFile(new File(['text'], 'fake.xlsx')), /not a valid/);
  await assert.rejects(parseExcelFile(new File(['text'], 'file.csv')), /Only .xlsx/);
  await assert.rejects(parseExcelFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx')), /5 MB/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(parseExcelFile(new File(['text'], 'test.xlsx'), controller.signal), { name: 'AbortError' });
});
