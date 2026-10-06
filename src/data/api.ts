export type ExcelCell = string | number | boolean | null;

export interface ExcelSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  rows: ExcelCell[][];
}

export interface ExcelUploadResult {
  filename: string;
  sheets: ExcelSheet[];
}

export const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isUploadResult(value: unknown): value is ExcelUploadResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ExcelUploadResult;
  return typeof result.filename === 'string' && Array.isArray(result.sheets) &&
    result.sheets.every((sheet) => sheet && typeof sheet.name === 'string' &&
      Number.isInteger(sheet.rowCount) && sheet.rowCount >= 0 &&
      Number.isInteger(sheet.columnCount) && sheet.columnCount >= 0 &&
      Array.isArray(sheet.rows) && sheet.rowCount === sheet.rows.length &&
      sheet.rows.every((row) => Array.isArray(row) && row.length === sheet.columnCount &&
        row.every((cell) => cell === null || ['string', 'number', 'boolean'].includes(typeof cell))));
}

/** Matches excel-import-poc/server.js: multipart field "file", POST /api/upload. */
export async function uploadExcel(file: File, signal?: AbortSignal): Promise<ExcelUploadResult> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Only .xlsx files are supported by the backend.');
  if (file.size > MAX_EXCEL_UPLOAD_BYTES) throw new Error('File is too large. Maximum allowed size is 5 MB.');

  const body = new FormData();
  body.append('file', file);
  const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Could not reach the upload backend. Check that the backend is running and the API connection is configured.');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('The backend did not return JSON. Check the API URL and that the backend is running.');
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : `Upload failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!isUploadResult(data)) throw new Error('The backend returned an unexpected Excel response.');
  return data;
}
