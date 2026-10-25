import * as XLSX from 'xlsx';
import { UPLOAD_HEADERS } from './workbook';

/** Download the current fourteen-column surveillance workbook. */
export function downloadExcelTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([UPLOAD_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Surveillance Data');
  XLSX.writeFile(workbook, 'AFP_HSEU_Standardized_Template.xlsx');
}
