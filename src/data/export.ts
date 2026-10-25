import * as XLSX from 'xlsx';

export const SUMMARY_HEADERS = ['Reporting Week', 'Disease', 'Province', 'Assigned Unit', 'Reporting Unit', 'Classification', 'Sex', 'Age Band', 'Cases'];

export function summaryCsv(rows: Record<string, string | number>[]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    // Spreadsheet programs must treat uploaded text as text, not executable formulas.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [SUMMARY_HEADERS.map(cell).join(','), ...rows.map(row => SUMMARY_HEADERS.map(header => cell(row[header])).join(','))].join('\r\n');
}

export function downloadSummary(rows: Record<string, string | number>[], format: 'csv' | 'xlsx'): void {
  if (format === 'xlsx') {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, { header: SUMMARY_HEADERS }), 'Surveillance Summary');
    XLSX.writeFile(workbook, 'AFP_Surveillance_Summary.xlsx');
    return;
  }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + summaryCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = 'AFP_Surveillance_Summary.csv';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
