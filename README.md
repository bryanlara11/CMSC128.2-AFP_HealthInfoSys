# AFP Health Information System frontend

Install and run the frontend:

```powershell
npm.cmd install
npm.cmd run dev
```

Demo: https://afp-healthinfosys-frontend-demo.vercel.app/

## Connect the Excel backend

The backend API is inside `excel-import-poc`, rather than the backend repository's React/Vite app. Run the API in one terminal:

```powershell
Set-Location 'C:\Users\Brian Lao\OneDrive\Desktop\128.2\backend\CMSC128.2-AFP_HealthInfoSys\CMSC128.2-AFP_HealtInfoSys\excel-import-poc'
npm.cmd install
npm.cmd start
```

It listens on `http://localhost:3000`. In another terminal, run this frontend:

```powershell
Set-Location 'C:\Users\Brian Lao\OneDrive\Desktop\128.2\front\CMSC128.2-AFP_HealthInfoSys'
npm.cmd run dev
```

Open the URL printed by Vite. Go to **Data Management > Upload Standardized Excel File** and select or drop a `.xlsx` file up to 5 MB. Upload starts automatically and data worksheets appear as tables below the upload area; the "How It Works" worksheet is hidden. Use the default I.T. Personnel role or another role with upload permission. You can use `excel-import-poc/test-files/Mock-Data.xlsx` to demonstrate the connection. The seven-column mock workbook has its header on row 4; title/description rows appear above the table and the 30 data records appear under their actual column names. Empty cells remain blank. Large tables have Previous/Next controls.

Successful uploads are saved in `localStorage` under `afp-hseu.imports.v1`, including the extracted workbook, upload time, and selected role. Recent Imports starts empty, supports search, and survives refreshes and module navigation. Click a filename to reopen its saved tables without contacting the backend. Remove deletes that import and its saved workbook. Record counts exclude header/preamble rows and the "How It Works" sheet. Storage belongs to the current browser and site origin; it is not shared across devices, ports, or users, and clearing site data removes it. Storage failures are shown in the page instead of claiming an upload was saved.

The request flow is:

```text
React â†’ POST /api/upload â†’ Vite development proxy â†’ Express on port 3000
      â† { filename, sheets: [{ name, rowCount, columnCount, rows }] }
```

`src/data/api.ts` sends `FormData` with the field name `file`, handles backend errors, and checks the response shape. `src/pages/DataManagementPage.tsx` handles both browse and drag-and-drop uploads. `src/components/WorkbookTables.tsx` renders every returned worksheet, using `src/data/workbook.ts` to identify the column headers. `vite.config.ts` proxies `/api` to the backend, so local development requires no backend CORS changes. The browser sets the multipart Content-Type boundary automatically.

The upload follows the backend's `.xlsx`/5 MB contract and displays the already standardized workbook without applying the old Table 1 validator. Download Template provides a seven-column `.xlsx` workbook. The error-batch button remains a separate Table 1 validation demonstration. Optional configuration is documented in `.env.example`: copy it to `.env.local` to change `BACKEND_URL`, then restart Vite.

## What remains for a complete backend connection

The inspected PoC only extracts spreadsheets and returns their contents. It does not persist records or provide authentication, import history, records management, dashboard metrics, or analytics APIs. Uploads and Recent Imports are stored in this browser for now; the Manage Records count and Analysis & Export reflect those saved imports. The Home dashboard still uses demo data. A successful upload does not insert records into a server database.

To connect the full system, the backend team needs to agree on the record schema and implement server-side validation, database insertion, record/history queries, dashboard/analytics queries, and authentication/role enforcement. The frontend can then call those endpoints instead of its demo arrays and local state. The current upload displays the standardized workbook supplied by the user.

For deployment, Vite's development proxy is unavailable in the static build. Configure your host to forward `/api` to the deployed Express service, or set `VITE_API_BASE_URL` to the deployed backend origin **before building** and configure backend CORS for the frontend origin. The inspected backend has no CORS middleware. `localhost:3000` is only for local development.

## Analysis of imported records

Analysis & Export reads the saved browser imports. Its default period is Past 7 Days, including today. Choose Last 2 Weeks (14 days including today), This Month (through today), Last Month (the full previous calendar month), or an inclusive Custom Range. Filters use `Date_Reported`, not the upload timestamp, and use the browser's local calendar date. Older sample files may require Last Month or a custom range to show cases.

The three summary cards, disease/age/sex charts, trend chart, and newest-first Filtered View Records all use the same filtered cases. Repeated case IDs use the newest upload; missing/invalid report dates are excluded and noted. The location chart is explicitly a placeholder and is omitted from exported reports. Excel exports contain all matching records and a summary worksheet; PDF uses the browser's Print / Save as PDF dialog with all matching records. Clearing or removing browser imports also removes them from analysis.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
node scripts/check-backend-api.mjs
node scripts/check-analytics.mjs
npx.cmd vite build --ssr scripts/check-analysis-render.tsx --outDir dist-ssr --logLevel error
node dist-ssr/check-analysis-render.js
```

The API checks use mocked responses to verify multipart requests, upload limits, backend errors, and response validation. To verify the real connection, start both servers and upload the backend's mock workbook using the steps above.
