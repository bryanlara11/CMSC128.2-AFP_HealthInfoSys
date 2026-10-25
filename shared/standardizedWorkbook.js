// Browser validation and the canonical fourteen-column upload contract.
export const UPLOAD_HEADERS = ['CASE ID', 'RP DATE', 'RP UNIT', 'RANK', 'OS', 'SURNAME', 'FIRST NAME', 'MIDDLE NAME', 'SEX', 'AGE', 'DISEASE', 'CASE CL', 'DS DATE', 'PROVINCE'];
export const normalizeHeader = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
export const isMissing = (value) => value == null || String(value).trim() === '';

export function dataSheets(workbook) {
  return workbook.sheets.filter(({ name }) => !/^(ref[ _-]|province[ _-]*lists?$|how\s+it\s+works$|instructions?$)/i.test(name.trim()));
}

export function sheetTable(sheet) {
  const known = new Set(UPLOAD_HEADERS);
  let headerIndex = -1;
  let bestMatch = 0;
  sheet.rows.forEach((row, index) => {
    const matches = row.filter((cell) => known.has(normalizeHeader(cell))).length;
    if (matches > bestMatch) { bestMatch = matches; headerIndex = index; }
  });
  if (bestMatch < 2) headerIndex = sheet.rows.findIndex((row) => row.filter((cell) => !isMissing(cell)).length >= 2);
  // Formatting can extend a worksheet's used range beyond its actual data.
  const width = sheet.rows.reduce((max, row) => Math.max(max, row.reduce((n, cell, index) => isMissing(cell) ? n : index + 1, 0)), 0);
  const headers = Array.from({ length: width }, (_, index) => String(sheet.rows[headerIndex]?.[index] ?? '').trim());
  let lastRow = sheet.rows.length - 1;
  while (lastRow > headerIndex && sheet.rows[lastRow].every(isMissing)) lastRow--;
  // Keep interior blank rows: these are incomplete records. Ignore unused trailing template rows.
  const rows = sheet.rows.slice(headerIndex + 1, lastRow + 1).map((cells, index) => ({
    cells: Array.from({ length: width }, (_, column) => cells[column] ?? null),
    excelRow: headerIndex + index + 2,
  }));
  const notes = headerIndex > 0 ? sheet.rows.slice(0, headerIndex)
    .map((row) => row.filter((cell) => !isMissing(cell)).join(' · ')).filter(Boolean) : [];
  return { headers, notes, rows, headerIndex };
}

export function validateWorkbook(workbook) {
  const sheets = dataSheets(workbook).map((sheet) => {
    const table = sheetTable(sheet);
    const headers = table.headers.map(normalizeHeader);
    const missing = UPLOAD_HEADERS.filter((header) => !headers.includes(header));
    const unexpected = headers.filter((header) => !UPLOAD_HEADERS.includes(header));
    const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
    const errors = [];
    if (table.headerIndex < 0) errors.push('No column header row found.');
    if (missing.length) errors.push(`Missing columns: ${missing.join(', ')}.`);
    if (unexpected.length) errors.push(`Unexpected columns: ${unexpected.map(h => h || '(blank header)').join(', ')}.`);
    if (duplicates.length) errors.push(`Duplicate columns: ${[...new Set(duplicates)].join(', ')}.`);
    if (!missing.length && !unexpected.length && !duplicates.length && headers.some((h, i) => h !== UPLOAD_HEADERS[i])) {
      errors.push(`Columns must follow this order: ${UPLOAD_HEADERS.join(', ')}.`);
    }
    const missingCount = table.rows.reduce((count, row) => count + row.cells.filter(isMissing).length, 0);
    const status = errors.length ? 'error' : missingCount || !table.rows.length ? 'incomplete' : 'complete';
    const reasons = errors.length ? errors : !table.rows.length ? ['No data records found.'] : missingCount ? [`${missingCount} missing value(s).`] : [];
    return { name: sheet.name, status, reasons, missingCount, recordCount: table.rows.length };
  });
  const status = !sheets.length || sheets.some(s => s.status === 'error') ? 'error' : sheets.some(s => s.status === 'incomplete') ? 'incomplete' : 'complete';
  return {
    schemaVersion: 1, status, sheets,
    recordCount: sheets.reduce((n, s) => n + s.recordCount, 0),
    missingCount: sheets.reduce((n, s) => n + s.missingCount, 0),
    reasons: sheets.length ? sheets.flatMap(s => s.reasons.map(reason => `${s.name}: ${reason}`)) : ['No surveillance data worksheet found.'],
  };
}
