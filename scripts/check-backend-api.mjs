import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import ts from 'typescript';

// Compile the actual client without needing a browser or Vite server.
const source = readFileSync(new URL('../src/data/api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText;
const apiModuleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const { uploadExcel, MAX_EXCEL_UPLOAD_BYTES } = await import(apiModuleUrl);
const originalFetch = globalThis.fetch;
const tableSource = readFileSync(new URL('../src/data/workbook.ts', import.meta.url), 'utf8');
const tableCompiled = ts.transpileModule(tableSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText;
const tableModuleUrl = `data:text/javascript;base64,${Buffer.from(tableCompiled).toString('base64')}`;
const { sheetTable, UPLOAD_HEADERS, dataSheets } = await import(tableModuleUrl);
const importsSource = readFileSync(new URL('../src/data/imports.ts', import.meta.url), 'utf8');
const importsCompiled = ts.transpileModule(importsSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll("'./api'", JSON.stringify(apiModuleUrl)).replaceAll("'./workbook'", JSON.stringify(tableModuleUrl));
const { readImports, writeImports, recordCount, IMPORTS_STORAGE_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(importsCompiled).toString('base64')}`
);
after(() => { globalThis.fetch = originalFetch; });
const file = new File(['workbook bytes'], 'example.xlsx');
const result = {
  filename: 'example.xlsx',
  sheets: [
    { name: 'Data', rowCount: 2, columnCount: 3, rows: [['ID', 'Value', 'Note'], ['001', null, '<b>text</b>']] },
    { name: 'Empty', rowCount: 0, columnCount: 0, rows: [] },
  ],
};

test('uploads the actual file using the backend multipart contract and preserves sheets/cells', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers, undefined, 'Browser must set the multipart boundary');
    assert.ok(options.body instanceof FormData);
    assert.deepEqual([...options.body.keys()], ['file']);
    const uploaded = options.body.get('file');
    assert.equal(uploaded.name, file.name);
    assert.equal(await uploaded.text(), await file.text());
    return Response.json(result);
  };
  assert.deepEqual(await uploadExcel(file, controller.signal), result);
});

test('rejects unsupported files and oversized files before making a request', async () => {
  globalThis.fetch = async () => { assert.fail('Invalid files must not be uploaded'); };
  await assert.rejects(uploadExcel(new File(['x'], 'data.csv')), /Only .xlsx/);
  await assert.rejects(uploadExcel(new File(['x'], 'data.xls')), /Only .xlsx/);
  await assert.rejects(uploadExcel(new File([new Uint8Array(MAX_EXCEL_UPLOAD_BYTES + 1)], 'large.xlsx')), /5 MB/);
});

test('surfaces backend validation errors and HTTP fallback errors', async () => {
  for (const status of [400, 413, 422]) {
    globalThis.fetch = async () => Response.json({ error: 'Workbook rejected' }, { status });
    await assert.rejects(uploadExcel(file), /Workbook rejected/);
  }
  globalThis.fetch = async () => Response.json({}, { status: 500 });
  await assert.rejects(uploadExcel(file), /HTTP 500/);
});

test('explains unreachable backends and non-JSON responses', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(uploadExcel(file), /Could not reach the upload backend/);
  globalThis.fetch = async () => new Response('<html>Proxy error</html>', { status: 502 });
  await assert.rejects(uploadExcel(file), /did not return JSON/);
});

test('rejects malformed workbook responses', async () => {
  for (const payload of [
    null,
    { filename: 'example.xlsx', sheets: [{}] },
    { filename: 'example.xlsx', sheets: [{ name: 'Data', rowCount: 2, columnCount: 1, rows: [['x']] }] },
    { filename: 'example.xlsx', sheets: [{ name: 'Data', rowCount: 1, columnCount: 1, rows: [[{}]] }] },
  ]) {
    globalThis.fetch = async () => Response.json(payload);
    await assert.rejects(uploadExcel(file), /unexpected Excel response/);
  }
});

test('preserves cancellation instead of reporting it as a connection error', async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, options) => { options.signal.throwIfAborted(); };
  await assert.rejects(uploadExcel(file, controller.signal), { name: 'AbortError' });
});

test('uses row 4 headers and displays exactly 30 records from the standardized workbook layout', () => {
  const rows = [
    ['Workbook title', null, null, null, null, null, null],
    ['Workbook description', null, null, null, null, null, null],
    Array(7).fill(null),
    UPLOAD_HEADERS,
    ...Array.from({ length: 30 }, (_, index) => [`CASE-${index + 1}`, '2026-09-19', 'Dengue', 'Unit A', 'Male', '18-29', 'Confirmed']),
  ];
  const table = sheetTable({ name: 'Mock Upload', rowCount: 34, columnCount: 7, rows });
  assert.deepEqual(table.headers, UPLOAD_HEADERS);
  assert.deepEqual(table.notes, ['Workbook title', 'Workbook description']);
  assert.equal(table.rows.length, 30);
  assert.equal(table.rows[0].excelRow, 5);
  assert.equal(table.rows[29].excelRow, 34);
});

test('handles instruction sheets, empty sheets, and single-column contents', () => {
  const instructions = sheetTable({ name: 'How It Works', rowCount: 2, columnCount: 2, rows: [['Step', 'Workflow'], ['1', 'Upload']] });
  assert.deepEqual(instructions.headers, ['Step', 'Workflow']);
  assert.equal(instructions.rows.length, 1);
  assert.deepEqual(sheetTable({ name: 'Empty', rowCount: 0, columnCount: 0, rows: [] }).rows, []);
  const single = sheetTable({ name: 'Notes', rowCount: 2, columnCount: 1, rows: [['first'], ['second']] });
  assert.equal(single.rows.length, 2);
  assert.equal(single.rows[0].excelRow, 1);
});

test('hides the How It Works worksheet and excludes its rows from saved record counts', () => {
  const workbook = { ...result, sheets: [...result.sheets,
    { name: '  HOW  IT WORKS ', rowCount: 2, columnCount: 2, rows: [['Step', 'Workflow'], ['1', 'Upload']] },
  ] };
  assert.deepEqual(dataSheets(workbook).map((sheet) => sheet.name), ['Data', 'Empty']);
  assert.equal(recordCount(workbook), 1);
});

test('browser storage preserves workbook data and metadata across reloads and removals', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readImports(storage), []);
  const first = { id: 'first', dateImported: '2026-10-05T00:00:00.000Z', importedBy: 'I.T. Personnel', workbook: result };
  const second = { ...first, id: 'second', workbook: { ...result, filename: 'second.xlsx' } };
  writeImports(storage, [second, first]);
  assert.deepEqual(readImports(storage), [second, first]);
  writeImports(storage, readImports(storage).filter((entry) => entry.id !== 'second'));
  assert.deepEqual(readImports(storage), [first]);
  writeImports(storage, []);
  assert.deepEqual(readImports(storage), []);
  assert.equal(values.get(IMPORTS_STORAGE_KEY), '[]');
});

test('rejects corrupt saved imports and surfaces browser storage failures', () => {
  for (const value of ['invalid JSON', '{}', '[{"id":"bad"}]']) {
    assert.throws(() => readImports({ getItem: () => value }));
  }
  assert.throws(() => readImports({ getItem: () => { throw new Error('Blocked'); } }), /Blocked/);
  assert.throws(() => writeImports({ setItem: () => { throw new Error('Quota exceeded'); } }, []), /Quota exceeded/);
});
