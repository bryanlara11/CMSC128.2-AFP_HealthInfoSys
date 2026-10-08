# Excel Import PoC: Implementation Guide

A proof of concept for a Node.js backend that accepts an uploaded Excel file and displays its contents in an HTML table. No styling, plain HTML only.

---

## 0. How to Use This Guide

Each step follows the same pattern:

- **Goal**: what should exist when the step is done.
- **Concepts**: what you need to understand before typing anything.
- **Do**: the concrete work. Skeleton code is given only where the wiring is boilerplate. The logic that matters is left for you to write.
- **Think about**: guiding questions. Answer them before moving on, because they point at the bugs you would otherwise meet later.
- **Checkpoint**: a check that proves the step works.

Do not skip the checkpoints. Data-import bugs are silent: the table renders, but a date is wrong or a blank cell shifted a column. Checkpoints catch that early.

---

## 1. Scope

### In scope

- Upload a single `.xlsx` file through a browser form.
- Parse it on the server.
- Return the contents as JSON.
- Render the contents as an HTML table, one per sheet.
- Accurate import: values, dates, blanks, and multiple sheets come through correctly.

### Out of scope (for now)

- Styling, CSS, frameworks.
- Charts, trends, aggregation.
- Database storage or persistence.
- Authentication.
- Files larger than a few MB.

### Why the scope is this narrow

Graphs and trends are only as good as the data under them. If the import step is subtly wrong, every chart built later is wrong. So this PoC is about one property only: **what is in the Excel file is exactly what appears on the page**.

---

## 2. Concepts to Understand First

### 2.1 How a file gets from browser to server

A file upload uses `multipart/form-data`, not JSON. The body is split into parts, each with its own headers, and one part carries the raw file bytes. Express does not parse this format on its own. A middleware has to.

### 2.2 Memory storage vs disk storage

The upload middleware can either write the file to disk and hand you a path, or keep the bytes in a `Buffer` in RAM. For this PoC you only need to parse the bytes once and discard them, so keeping them in memory avoids temp-file cleanup. The trade-off is that large files use RAM, which is why you set a size limit.

### 2.3 What an `.xlsx` file actually is

An `.xlsx` is a ZIP archive of XML files. You never parse that yourself. A library reads it into a **workbook** model:

```
Workbook
 └── Sheets (ordered, each has a name)
      └── Cells (address like "B3", each has a type, raw value, and formatted text)
```

### 2.4 Why cell types matter

Excel stores dates as numbers (days since an epoch), and a formula cell stores both a formula and a cached result. A number formatted as `12.50` may be stored as `12.5`. Each of these can give a different "accurate" answer depending on which you ask the library for. You must decide deliberately, not by accident.

### 2.5 Why parse on the server

The end goal is data analysis on real files. Doing it on the server keeps parsing logic in one place, testable without a browser, and reusable when the graphing work starts.

---

## 3. Stack and Decisions

| Concern         | Choice                                             | Reason                                                        |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Runtime         | Node.js 20 LTS or newer                            | Current LTS line, has the built-in test runner                |
| Web framework   | Express                                            | Minimal, widely documented                                    |
| Upload handling | `multer` with memory storage                       | Standard multipart middleware for Express                     |
| Excel parsing   | SheetJS (`xlsx`)                                   | Simple sheet-to-array API, good control over dates and blanks |
| Frontend        | One static `index.html` with a small inline script | No build step, meets "HTML will do"                           |
| Module system   | ES modules (`"type": "module"`)                    | Modern default, matches browser code                          |

### Decision to make: which SheetJS install source

The copy of `xlsx` on the npm registry is old and has known security advisories. The SheetJS maintainers distribute current versions from their own CDN and document installing from there. Check `docs.sheetjs.com` for the current install command and use that. Since your work touches cybersecurity compliance, treat this as a small real-world supply-chain decision: note which version you installed and why.

**Alternative**: `exceljs` is maintained on npm and works too, but its cell values come back as objects for formulas and rich text, so the normalization code is heavier. If you pick it, expect more work in Step 5.

---

## 4. Prerequisites

- Node.js 20+ and npm (`node -v`, `npm -v`).
- A terminal and a code editor.
- Microsoft Excel or LibreOffice Calc to create test files.
- `curl` (for testing the API without the browser).

---

## 5. Project Structure

```
excel-import-poc/
├── package.json
├── server.js              # Express app: routes and middleware wiring
├── src/
│   └── parseExcel.js      # Pure parsing logic: Buffer in, plain data out
├── public/
│   └── index.html         # Upload form + table rendering
└── test-files/
    ├── basic.xlsx
    ├── tricky.xlsx
    └── not-excel.txt
```

**Design rule**: `parseExcel.js` must not know Express exists. It takes a `Buffer` and returns plain objects. This is what makes it testable in isolation now and reusable by the graphing code later.

---

## 6. Step-by-Step

### Step 1: Initialize the project

**Goal**: an empty Node project configured for ES modules.

**Do**

```bash
mkdir excel-import-poc && cd excel-import-poc
npm init -y
```

Then edit `package.json` to add `"type": "module"` and a start script (`"start": "node server.js"`).

**Think about**

- What changes in how you write `import` and `export` once `"type": "module"` is set?

**Checkpoint**: `npm start` fails only because `server.js` does not exist yet, not because of a config error.

---

### Step 2: Install dependencies

**Goal**: Express, multer, and SheetJS installed.

**Do**

```bash
npm install express multer
```

Install SheetJS using the instructions on `docs.sheetjs.com` (see the decision note in section 3).

**Think about**

- Open `package.json`. What version of each package did you get? Are any of them major versions you have not used before? Skim the README of each for breaking changes.

**Checkpoint**: `npm ls` lists all three with no errors.

---

### Step 3: Minimal server serving a static page

**Goal**: visiting `http://localhost:3000` shows a page from `public/index.html`.

**Concepts**: static file serving means Express maps URL paths to files in a folder.

**Do**

1. Create `public/index.html` containing only a heading.
2. In `server.js`, create an Express app, serve the `public` folder statically, and listen on port 3000.

Skeleton:

```js
import express from "express";

const app = express();

// TODO: serve the "public" directory as static files

// TODO: start listening on a port and log the URL
```

**Think about**

- With ES modules, `__dirname` does not exist. If you build the path to `public` manually, how do you get the current directory? (Look up `import.meta.url`. Also consider whether a relative path is enough and when it would break.)

**Checkpoint**: the browser shows your heading.

---

### Step 4: The upload endpoint

**Goal**: `POST /api/upload` accepts one file and responds with its name and size. No parsing yet.

**Concepts**

- Middleware runs before your route handler and can reject the request.
- `multer` needs to know the form field name that carries the file. The field name in the HTML form and in `upload.single(...)` must match exactly.

**Do**

1. Configure multer with memory storage.
2. Set a `limits.fileSize` (start with 5 MB).
3. Add a `fileFilter` that rejects files whose extension is not `.xlsx`.
4. Add the route. Inside the handler, the file bytes are on the request object as a `Buffer`. Respond with JSON containing the original name and byte length.

Skeleton:

```js
import multer from "multer";

const upload = multer({
  // TODO: storage (memory)
  // TODO: limits
  // TODO: fileFilter
});

app.post("/api/upload", upload.single(/* field name */), (req, res) => {
  // TODO: what if req.file is undefined?
  // TODO: respond with { filename, sizeBytes }
});
```

**Think about**

- What should the response be if no file was sent at all? Which HTTP status code fits?
- The extension is controlled by the client. Is checking it enough to trust the file? (You will strengthen this in Step 8.)

**Checkpoint (curl)**

```bash
curl -F "file=@test-files/basic.xlsx" http://localhost:3000/api/upload
```

Expect JSON with the name and size. Then try the same with `not-excel.txt` and confirm it is rejected. Create the test files first (see Step 9).

---

### Step 5: Parse the workbook

**Goal**: `parseExcel(buffer)` returns structured data for every sheet.

**Concepts**

- Reading a workbook from a buffer, then iterating its sheet names.
- Converting a sheet to an array of arrays (rows of cells) is the safest shape for a PoC. It preserves column order and avoids the library guessing at header names.
- Options on the conversion decide correctness. Investigate each of these in the SheetJS docs and decide a value for each:

| Option or concern       | Question to answer                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Date handling           | Do dates come out as serial numbers or real dates? Which do you want to display?              |
| Blank cells             | Should a gap become `null`, `""`, or be skipped? What happens to column alignment if skipped? |
| Raw vs formatted values | Should `12.5` formatted as `12.50` show as `12.5` or `12.50`?                                 |
| Formulas                | Do you show the cached result or the formula text?                                            |
| Header row              | Do you assume row 1 is the header, or leave that decision for later?                          |

**Do**

1. Write `src/parseExcel.js` exporting one function.
2. The function reads the buffer into a workbook.
3. For each sheet, produce an object with the sheet name and its rows.
4. Return an object with a `sheets` array.

Skeleton:

```js
import * as XLSX from "xlsx";

export function parseExcel(buffer) {
  // TODO: read the workbook from the buffer (choose the right "type" and date option)
  // TODO: for each sheet name, convert the sheet to an array of rows
  //       (choose options for blanks and raw vs formatted values)
  // TODO: return { sheets: [{ name, rows }] }
}
```

**Think about**

- What does the library do when the file is corrupt or not really an Excel file? Should `parseExcel` throw, or return an error value? Who should handle it?
- What does an entirely empty sheet produce? Does your code survive it?
- Rows can have different lengths when trailing cells are empty. Will that break table rendering later?

**Checkpoint**: write a throwaway script that reads `test-files/basic.xlsx` from disk with `fs`, calls `parseExcel`, and prints the result with `console.log(JSON.stringify(result, null, 2))`. Compare the output against the file by eye, cell by cell.

---

### Step 6: Define the API response contract

**Goal**: a stable JSON shape the frontend depends on.

Agree on the shape before wiring anything. A suggested contract:

```json
{
  "filename": "basic.xlsx",
  "sheets": [
    {
      "name": "Sheet1",
      "rowCount": 4,
      "columnCount": 3,
      "rows": [
        ["Name", "Score", "Date"],
        ["Ana", 90, "2025-01-15"]
      ]
    }
  ]
}
```

**Do**: connect `parseExcel` into the upload route and return this shape. Compute `rowCount` and `columnCount` in the route or the parser.

**Think about**

- `columnCount` should be the width of the widest row, not the width of the first row. Why?
- JSON cannot represent a JavaScript `Date`. If you kept real dates in Step 5, how do they arrive in the browser? Is that format unambiguous, and does time zone matter?

**Checkpoint (curl)**: the response for `basic.xlsx` matches the contract exactly.

---

### Step 7: Frontend upload form and table rendering

**Goal**: choose a file, submit, and see one table per sheet.

**Concepts**

- Submitting via `fetch` with a `FormData` object sends multipart data. You must not set the `Content-Type` header yourself, because the browser has to add the boundary string.
- Building DOM nodes with `createElement` and `textContent` is safer than concatenating HTML strings.

**Do**: in `public/index.html`:

1. A file input (restrict with `accept=".xlsx"`) and an upload button.
2. A `div` where results appear and a place for error messages.
3. A script that, on submit, builds `FormData`, posts to `/api/upload`, and checks `response.ok`.
4. A `renderSheets(data)` function that clears the results area, then for each sheet adds a heading with the sheet name and a `<table>` built from `rows`.

Skeleton:

```html
<h1>Excel Import PoC</h1>

<form id="upload-form">
  <input type="file" id="file-input" name="file" accept=".xlsx" required />
  <button type="submit">Upload</button>
</form>

<p id="status"></p>
<div id="results"></div>

<script>
  const form = document.getElementById("upload-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // TODO: build FormData with the field name the server expects
    // TODO: fetch POST to /api/upload (no manual Content-Type header)
    // TODO: on error, show the message in #status
    // TODO: on success, call renderSheets(data)
  });

  function renderSheets(data) {
    // TODO: for each sheet: heading + table
    // TODO: use textContent, not innerHTML, for cell values
  }
</script>
```

**Think about**

- A cell containing `<script>alert(1)</script>` in an uploaded file: what happens if you use `innerHTML`? What happens with `textContent`? Why does this matter even for an internal tool?
- For a table with a header, should the first row use `<th>`? Since you have not decided on headers yet, is it acceptable to render every row as `<td>` for now?
- Should `null` cells render as an empty string, or the text "null"?

**Checkpoint**: upload `basic.xlsx` in the browser. The table on the page matches the spreadsheet exactly.

---

### Step 8: Error handling and validation

**Goal**: bad input produces clear errors, never a crash or a hung request.

**Do**

1. Handle multer errors (for example, file too large) with an error-handling middleware. Return a JSON error and a suitable status code.
2. Wrap the parse call in `try/catch` and return a readable error for unparseable files.
3. Strengthen validation beyond the extension: an `.xlsx` file is a ZIP, so its first bytes are `PK` (`0x50 0x4B`). Check the buffer's first bytes before parsing.
4. Make sure the frontend shows the server's error message rather than failing silently.

**Think about**

- Where does the multer size-limit error surface: inside your route or in error middleware? Test it and find out rather than guessing.
- What would you do about an old `.xls` file? For the PoC, is rejecting it with a clear message acceptable?
- What happens if someone renames `notes.txt` to `notes.xlsx`? Which check catches it?

**Checkpoint**: all the failure cases in the verification table (Step 9) return the expected error and the server stays up.

---

### Step 9: Verification with purpose-built test files

**Goal**: prove accuracy, not just that "something rendered".

Create these files in Excel or LibreOffice:

**`basic.xlsx`**: one sheet, a header row, 3 to 5 data rows of text, whole numbers, and decimals.

**`tricky.xlsx`**: three sheets, containing:

| Case               | What to include                                                |
| ------------------ | -------------------------------------------------------------- |
| Multiple sheets    | Three sheets with different names, one containing a space      |
| Dates              | A date column and a cell with date and time                    |
| Blank cells        | A blank in the middle of a row and a blank at the end of a row |
| Formulas           | A cell like `=B2*2`, checking the cached result comes through  |
| Number formats     | A value formatted as currency or percentage                    |
| Long text          | A cell with a long string                                      |
| Special characters | Accents, emoji, and a cell containing `<b>bold</b>`            |
| Empty sheet        | A sheet with no data at all                                    |
| Merged cells       | A merged range across several columns                          |
| Leading zeros      | A text cell containing `00123`                                 |

**`not-excel.txt`**: any text file.

**Verification table**: fill this in as you test.

| Test                           | Expected                               | Actual | Pass |
| ------------------------------ | -------------------------------------- | ------ | ---- |
| Upload `basic.xlsx`            | Table matches sheet                    |        |      |
| Upload `tricky.xlsx`           | 3 tables, correct names                |        |      |
| Dates                          | Display matches Excel                  |        |      |
| Blank in the middle of a row   | Columns stay aligned                   |        |      |
| Formula cell                   | Shows calculated value                 |        |      |
| Percentage cell                | Behaviour matches your Step 5 decision |        |      |
| `<b>bold</b>` cell             | Shown literally, not rendered as bold  |        |      |
| Empty sheet                    | No crash                               |        |      |
| Merged cells                   | Behaviour is understood and noted      |        |      |
| `00123`                        | Keeps leading zeros                    |        |      |
| `not-excel.txt`                | Rejected with a clear message          |        |      |
| `notes.txt` renamed to `.xlsx` | Rejected by the byte check             |        |      |
| File over the size limit       | Rejected, server stays up              |        |      |
| Submit with no file            | Clear error, status 400                |        |      |

Where a result surprises you, do not just patch it. Write down what the library did and why, since these findings shape the analysis code later.

**Optional automated test**: use Node's built-in test runner (`node --test`). Write a test that loads `basic.xlsx` from disk, passes it to `parseExcel`, and asserts the exact expected rows. This locks the behaviour in before you add features.

---

## 7. Common Pitfalls

| Symptom                                        | Likely cause                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `req.file` is `undefined`                      | Form field name differs from `upload.single('...')`, or `enctype` or `FormData` is wrong |
| `Unexpected field` error                       | Same mismatch as above                                                                   |
| Dates show as numbers like `45672`             | Date parsing was not enabled when reading or converting                                  |
| Columns shift after a blank cell               | Blanks were skipped instead of filled                                                    |
| Upload works in curl but not in the browser    | A manual `Content-Type` header was set on the fetch                                      |
| `Cannot use import statement outside a module` | `"type": "module"` missing from `package.json`                                           |
| `__dirname is not defined`                     | Using CommonJS globals inside ES modules                                                 |
| Very large file freezes the server             | No size limit, and parsing is synchronous                                                |

---

## 8. Security Notes

Even for a PoC, build these habits now:

- **Never trust the file extension or MIME type.** Both are client-supplied. Check the file signature.
- **Limit file size** at the middleware level.
- **Render with `textContent`.** Spreadsheet cells are untrusted input.
- **Do not store or serve uploads** in this PoC. Memory storage means nothing lands on disk.
- **Parsing is synchronous and CPU-bound.** A malicious or huge file can block the event loop. Note this as a known limitation for later (worker threads or a queue).
- **Keep parsing library versions tracked.** Spreadsheet parsers have a history of vulnerabilities. Record the version and re-check it before this ever handles real data.
- **Formula injection** (cells starting with `=`, `+`, `-`, `@`) matters if you later export data back to a spreadsheet. Note it now.

---

## 9. Definition of Done

- [ ] `npm start` launches the server without errors.
- [ ] A `.xlsx` can be uploaded from the browser.
- [ ] Every sheet renders as its own table with its sheet name.
- [ ] Values in the table match the source file exactly, including dates, blanks, and leading zeros.
- [ ] Non-Excel files, oversized files, and empty submissions are rejected with clear messages.
- [ ] `parseExcel.js` has no Express dependency.
- [ ] The verification table is filled in, with notes on any surprising behaviour.
- [ ] The response contract is written down and stable.

---

## 10. Looking Ahead (Not Part of This PoC)

Decisions to make once accurate import is proven:

1. **Header detection**: how does the app know row 1 is a header, and what about files with title rows above it?
2. **Type inference**: deciding whether a column is numeric, date, or categorical is the first step of any charting.
3. **Data shape for charts**: array of row objects keyed by header vs column arrays. Which does your chart library want?
4. **Persistence**: keep parsed data in memory, or store it in a database?
5. **Larger files**: streaming parsers and background processing.
6. **Multiple uploads and comparison** over time, which is what "trends" implies.

Because parsing sits behind a single function with a clear contract, each of these can be added without rewriting the upload flow.
