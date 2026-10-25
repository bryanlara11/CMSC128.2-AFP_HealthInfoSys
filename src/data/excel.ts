import * as XLSX from 'xlsx';
import { MAX_EXCEL_UPLOAD_BYTES, type ExcelUploadResult } from './excelTypes';
import { validateWorkbook } from './workbook';

/** Read file bytes locally. Supabase receives JSON and validates it again in PostgreSQL. */
export async function parseExcelFile(file: File, signal?: AbortSignal): Promise<ExcelUploadResult> {
  signal?.throwIfAborted();
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Only .xlsx files are supported.');
  if (file.size > MAX_EXCEL_UPLOAD_BYTES) throw new Error('File is too large. Maximum allowed size is 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('This file is not a valid .xlsx workbook.');
  let source: XLSX.WorkBook;
  try { source = XLSX.read(bytes, { type: 'array', cellDates: true, cellNF: true }); }
  catch { throw new Error('The Excel file could not be read. Check that it is a valid, unencrypted .xlsx file.'); }
  if (source.SheetNames.length > 200) throw new Error('The workbook contains too many worksheets (maximum 200).');
  let rowTotal = 0;
  const sheets = source.SheetNames.map(name => {
    const worksheet = source.Sheets[name];
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
    if (range && (range.e.r > 100000 || range.e.c > 99)) throw new Error('A worksheet exceeds the supported range (100,000 rows and 100 columns).');
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd', blankrows: true,
    });
    rowTotal += rows.length;
    if (rowTotal > 100000) throw new Error('The workbook exceeds the maximum of 100,000 rows.');
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const padded = rows.map(row => Array.from({ length: columnCount }, (_, i) => row[i] ?? null));
    return { name, rowCount: padded.length, columnCount, rows: padded };
  });
  const result = { filename: file.name, sheets };
  signal?.throwIfAborted();
  return { ...result, validation: validateWorkbook(result) };
}
