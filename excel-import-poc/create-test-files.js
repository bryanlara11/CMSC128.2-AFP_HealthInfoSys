/**
 * Generate test Excel files for the PoC verification table.
 * Run with: node create-test-files.js
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, "test-files");

if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// ============================================================
// basic.xlsx — one sheet, header row, 3-5 data rows of text,
// whole numbers, and decimals
// ============================================================
function createBasic() {
  const data = [
    ["Name", "Score", "Grade", "GPA"],
    ["Ana", 90, "A", 3.85],
    ["Ben", 78, "B+", 3.21],
    ["Cara", 95, "A+", 3.97],
    ["Dan", 62, "C", 2.50],
    ["Eva", 88, "B+", 3.64],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, path.join(testDir, "basic.xlsx"));
  console.log("✓ Created basic.xlsx");
}

// ============================================================
// tricky.xlsx — three sheets with edge cases
// ============================================================
function createTricky() {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: "Data Sheet" (name contains a space) ---
  // Contains dates, formulas, number formats, blank cells
  const sheet1Data = [
    ["ID", "Name", "Date Joined", "Salary", "Bonus", "Total"],
    [1, "Alice", new Date("2024-03-15"), 50000, 5000, null], // formula placeholder
    [2, "Bob", new Date("2023-11-20T14:30:00"), 62000, 6200, null],
    [3, null, new Date("2025-01-01"), 45000, null, null], // blank name, blank bonus
    [4, "Diana", null, 55000, 5500, null], // blank date
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Set formulas for the Total column (=D2+E2)
  ws1["F2"] = { t: "n", v: 55000, f: "D2+E2" };
  ws1["F3"] = { t: "n", v: 68200, f: "D3+E3" };
  ws1["F4"] = { t: "n", v: 45000, f: "D4+E4" };
  ws1["F5"] = { t: "n", v: 60500, f: "D5+E5" };

  // Format salary column as currency
  ws1["D2"].z = "$#,##0.00";
  ws1["D3"].z = "$#,##0.00";
  ws1["D4"].z = "$#,##0.00";
  ws1["D5"].z = "$#,##0.00";

  // Format bonus as percentage of salary (just to test percentage format)
  // We'll add a separate percentage cell
  ws1["G1"] = { t: "s", v: "Bonus %" };
  ws1["G2"] = { t: "n", v: 0.10, z: "0.00%" };
  ws1["G3"] = { t: "n", v: 0.10, z: "0.00%" };
  ws1["G4"] = { t: "n", v: 0, z: "0.00%" };
  ws1["G5"] = { t: "n", v: 0.10, z: "0.00%" };

  // Update range to include column G
  ws1["!ref"] = "A1:G5";

  XLSX.utils.book_append_sheet(wb, ws1, "Data Sheet");

  // --- Sheet 2: "SpecialChars" ---
  // Long text, accents, emoji, HTML injection, leading zeros, merged cells
  const sheet2Data = [
    ["Type", "Value"],
    ["Accented", "José García Müller — naïve café résumé"],
    ["Emoji", "🎉 Hello 🌍 World 🚀 Test 💯"],
    ["HTML injection", "<b>bold</b>"],
    ["Script injection", "<script>alert(1)</script>"],
    ["Leading zeros", "00123"],
    [
      "Long text",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    ],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

  // Merged cells: merge A8:C8
  ws2["A8"] = { t: "s", v: "This cell is merged across columns A-C" };
  ws2["!merges"] = [{ s: { r: 7, c: 0 }, e: { r: 7, c: 2 } }];
  // Update range
  ws2["!ref"] = "A1:C8";

  XLSX.utils.book_append_sheet(wb, ws2, "SpecialChars");

  // --- Sheet 3: "EmptySheet" ---
  // A sheet with no data at all
  const ws3 = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, ws3, "EmptySheet");

  XLSX.writeFile(wb, path.join(testDir, "tricky.xlsx"));
  console.log("✓ Created tricky.xlsx");
}

// ============================================================
// not-excel.txt — any text file (for rejection testing)
// ============================================================
function createNotExcel() {
  fs.writeFileSync(
    path.join(testDir, "not-excel.txt"),
    "This is a plain text file, not an Excel workbook.\nIt should be rejected by the upload endpoint.\n"
  );
  console.log("✓ Created not-excel.txt");
}

// Run all
createBasic();
createTricky();
createNotExcel();
console.log("\nAll test files created in test-files/");
