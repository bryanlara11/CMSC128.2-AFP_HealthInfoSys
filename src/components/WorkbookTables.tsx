import { useState } from 'react';
import type { ExcelSheet, ExcelUploadResult } from '../data/api';
import { dataSheets, sheetTable } from '../data/workbook';

const PAGE_SIZE = 100;

function WorksheetTable({ sheet }: { sheet: ExcelSheet }) {
  const [page, setPage] = useState(0);
  const { headers, notes, rows } = sheetTable(sheet);
  const start = page * PAGE_SIZE;
  return (
    <section className="card p-6 space-y-3" aria-label={`Worksheet ${sheet.name}`}>
      <h2 className="text-base font-semibold text-primary">{sheet.name}</h2>
      {notes.map((note, index) => <p key={index} className="text-sm text-text-secondary">{note}</p>)}
      <p className="text-xs text-text-muted">{rows.length} data rows · {sheet.columnCount} columns</p>
      {rows.length === 0 ? <p className="text-sm text-text-secondary">This worksheet has no data rows.</p> : (
        <>
          <div className="table-container max-h-96 overflow-auto">
            <table className="table-base">
              <caption className="sr-only">Contents of {sheet.name}</caption>
              <thead><tr>
                <th scope="col">Excel Row</th>
                {headers.map((header, column) => <th key={column} scope="col">{header}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(start, start + PAGE_SIZE).map(({ cells, excelRow }) => (
                  <tr key={excelRow}>
                    <th scope="row">{excelRow}</th>
                    {cells.map((cell, column) => <td key={column} className="whitespace-pre-wrap">{cell === null ? '' : String(cell)}</td>)}
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

export function WorkbookTables({ workbook }: { workbook: ExcelUploadResult }) {
  const sheets = dataSheets(workbook);
  return <div className="space-y-6">
    {sheets.map((sheet, index) => <WorksheetTable key={index} sheet={sheet} />)}
    {sheets.length === 0 && <p className="text-sm text-text-secondary">This workbook contains no data worksheets.</p>}
  </div>;
}
