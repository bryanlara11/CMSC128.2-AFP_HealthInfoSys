import * as XLSX from "xlsx";

/**
 * Parse an Excel (.xlsx) buffer and return structured data for every sheet.
 *
 * Design rule: this module has NO Express dependency.
 * It takes a Buffer and returns plain objects, making it testable in isolation
 * and reusable by future graphing/analysis code.
 *
 * Decisions made (per IMPLEMENTATION.md Step 5):
 * - Dates: cellDates=true so dates come as JS Date objects, then converted to ISO strings for JSON safety
 * - Blank cells: defval=null to preserve column alignment (gaps become null, not skipped)
 * - Raw vs formatted: raw=false to get formatted values (e.g. "12.50" stays "12.50")
 *   BUT we override this for dates to use ISO strings for unambiguous representation
 * - Formulas: we show cached results, not formula text (default behavior)
 * - Header row: no assumption — all rows returned as arrays, consumer decides
 *
 * @param {Buffer} buffer - Raw bytes of the uploaded .xlsx file
 * @returns {{ sheets: Array<{ name: string, rowCount: number, columnCount: number, rows: any[][] }> }}
 */
export function parseExcel(buffer) {
  // Read the workbook from buffer with date parsing enabled
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true, // Convert date serial numbers to JS Date objects
    cellNF: true,    // Preserve number format strings
  });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to array of arrays (rows)
    // defval: null ensures blank cells become null (preserving column alignment)
    // raw: false gives formatted values (respects Excel number formats)
    // dateNF: provides a consistent date format
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,      // Return array of arrays, not objects with header keys
      defval: null,    // Blank cells become null (not skipped — prevents column shifting)
      raw: false,      // Use formatted values so "12.50" stays "12.50"
      dateNF: "yyyy-mm-dd", // Consistent date format for unambiguous display
    });

    // Compute columnCount as the width of the WIDEST row, not just the first
    // (trailing blank cells can make rows have different lengths)
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    // Normalize all rows to the same width so the HTML table aligns correctly
    const normalizedRows = rows.map((row) => {
      const padded = [...row];
      while (padded.length < columnCount) {
        padded.push(null);
      }
      return padded;
    });

    return {
      name: sheetName,
      rowCount: normalizedRows.length,
      columnCount,
      rows: normalizedRows,
    };
  });

  return { sheets };
}
