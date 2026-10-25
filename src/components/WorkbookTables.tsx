import { useState } from 'react';
import type { ExcelSheet, ExcelUploadResult } from '../data/excelTypes';
import type { UploaderProfile } from '../data/profile';
import { dataSheets, isMissing, sheetTable, validateWorkbook } from '../data/workbook';
import { ImportStatus } from './ImportStatus';

const PAGE_SIZE = 100;

function WorksheetTable({ sheet }: { sheet: ExcelSheet }) {
  const [page, setPage] = useState(0);
  const { headers, rows } = sheetTable(sheet);
  const validation = validateWorkbook({ filename: '', sheets: [sheet] }).sheets[0];
  const start = page * PAGE_SIZE;
  return (
    <section className="space-y-3" aria-label={`Worksheet ${sheet.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-primary">{sheet.name}</h3>
        <ImportStatus status={validation.status} reasons={validation.reasons} />
      </div>
      <p className="text-xs text-text-muted">{rows.length} data rows · {headers.length} columns · {validation.missingCount} missing values. Scroll horizontally to view all columns.</p>
      {rows.length === 0 ? <p className="text-sm text-text-secondary">This worksheet has no data rows.</p> : (
        <>
          <div className="table-container max-h-96 overflow-auto">
            <table className="table-base min-w-[1600px]">
              <caption className="sr-only">Contents of {sheet.name}; missing values are marked in red.</caption>
              <thead className="sticky top-0 z-10"><tr>
                <th scope="col">Excel Row</th>
                {headers.map((header, column) => <th key={column} scope="col" className="whitespace-nowrap">{header || 'Missing header'}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(start, start + PAGE_SIZE).map(({ cells, excelRow }) => (
                  <tr key={excelRow}>
                    <th scope="row">{excelRow}</th>
                    {cells.map((cell, column) => <td key={column} className="whitespace-nowrap">
                      {isMissing(cell) ? <span className="text-status-danger font-medium">missing</span> : String(cell)}
                    </td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > PAGE_SIZE && <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Rows {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}</span>
            <button type="button" className="btn-secondary" disabled={start + PAGE_SIZE >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>}
        </>
      )}
    </section>
  );
}

export function WorkbookTables({ workbook, uploader, error }: { workbook: ExcelUploadResult; uploader?: UploaderProfile; error?: string }) {
  const sheets = dataSheets(workbook);
  const validation = validateWorkbook(workbook);
  const reasons = error ? [error] : validation.reasons;
  const status = error ? 'error' : validation.status;
  return <section className="card p-4 sm:p-6 space-y-5" aria-labelledby="preview-heading">
    <div className="space-y-3 border-b border-storm-200 pb-4">
      <h2 id="preview-heading" className="text-lg font-semibold text-primary">Table preview</h2>
      <div className="flex flex-wrap items-center gap-3">
        <p className={`font-semibold break-all ${status === 'error' ? 'text-status-danger' : 'text-primary'}`}>{workbook.filename}</p>
        <ImportStatus status={status} reasons={reasons} />
      </div>
      {uploader ? <div className="text-sm text-text-secondary space-y-1">
        <p className="font-semibold text-primary">{uploader.assignedUnit}</p>
        <p>Uploaded by {uploader.fullName} · {uploader.role}</p>
        <p className="break-all">{uploader.email}</p>
      </div> : <p className="text-sm text-text-muted">Uploader profile was not recorded for this older import.</p>}
      {status === 'error' && <p role="alert" className="text-sm text-status-danger">{reasons.join(' ')}</p>}
      {status === 'incomplete' && <p className="text-sm text-text-secondary">{validation.missingCount} missing value(s). Blank cells appear as <span className="text-status-danger font-medium">missing</span>.</p>}
    </div>
    {sheets.map((sheet, index) => <WorksheetTable key={index} sheet={sheet} />)}
    {sheets.length === 0 && <p className="text-sm text-text-secondary">No surveillance tables are available for preview.</p>}
  </section>;
}
