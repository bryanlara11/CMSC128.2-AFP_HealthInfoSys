# AFP Health Information System

The React/Vite application connects directly to Supabase Auth and PostgreSQL. Excel workbooks are parsed in the browser, and database functions enforce validation, permissions and persistence. A separate Express backend is not required.

## Setup

1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using `.env.example`.
2. Apply the database migrations in order. Existing installations with migrations 001 and 002 should run the new `202610250003_analytics_editing_audit.sql` once.
3. Create your accounts under Supabase Authentication, then run `supabase/setup-test-profiles.sql` to assign their roles and the agreed unit, Victoriano Luna Medical Center.
4. Start the application:

```powershell
npm.cmd install
npm.cmd run dev
```

See [the complete Supabase setup guide](supabase/README.md) for account creation, role rules and troubleshooting. Start only the Vite application; no separate backend process is needed.

## Finalized Excel format

Data Management accepts `.xlsx` files up to 5 MB with these fourteen headers in order:

```text
CASE ID | RP DATE | RP UNIT | RANK | OS | SURNAME | FIRST NAME | MIDDLE NAME | SEX | AGE | DISEASE | CASE CL | DS DATE | PROVINCE
```

Download Template produces a blank workbook. Individual hospital files and the masterlist under `sample-data/samples` are supported. Reference sheets and unused trailing blank rows are excluded from surveillance records. Title rows above the table are supported. Interior blank rows are retained.

- **Complete:** correct columns, at least one record, and no missing values.
- **Incomplete:** correct columns but missing values or no records.
- **Error:** incorrect columns or an unreadable/unsupported file. Hover or focus the error icon for details.

Table preview displays the filename, status, uploader profile and actual records. Blank values appear as **missing** in red. All fourteen fields participate in completeness checks. Database validation independently recomputes the status and records. Files with column errors remain in history and create no surveillance records.

Import history comes from Supabase and is shared according to assigned-unit permissions. It supports searching and reopening previews. Only I.T. Personnel can remove imports. Profile names can be updated in Account Settings; roles and assigned units are administrator-managed. Earlier browser-stored imports are not automatically migrated; re-upload the original files after signing in.

Dashboard and analysis charts query uploaded records in Supabase. Date, disease, province, and assigned-unit filters apply to server-side aggregates. The default view includes all reporting dates; dated charts exclude missing or invalid reporting dates. Records are counted as uploaded rows, without patient deduplication. CSV and Excel exports contain aggregate counts, not patient identifiers, and require full surveillance access.

Data Management supports individual record editing with separate demographic and clinical permissions, version checks to prevent overwriting another user's changes, and atomic updates to the source workbook and validation status. Admin / Information Clerks can edit demographics through this view; analysts use aggregates and error summaries rather than patient-row editors.

Persistent events are stored in `audit_events`. Imports, import deletion, record edits, and profile updates are audited by database triggers. Analytics views, record views, and exports are audited by database functions. Successful app logins, app logouts, and inactivity sign-outs are recorded through an authenticated access-event function. Logs are append-only for application accounts. I.T. can view all events; Medical Officers can view events for their unit. Other roles can see their own recent activity.

The primary frontend color is `#0A3D62`, with gray backgrounds and white surfaces. The repository contains one application. The old nested React scaffold, Express backend, browser-storage fallback, and obsolete sample generators/checks have been removed.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run check:connection
```

Supabase migration checks use local PostgreSQL through PGlite. The connection check makes a read-only request to the configured hosted project. See the setup guide for hosted verification after applying migrations and creating profiles.

For static deployment, set the two `VITE_SUPABASE_*` values before building. Supabase handles data APIs and authentication; the Vite development proxy is no longer needed.

The GitHub Pages workflow reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from repository Actions secrets when building. Configure those values for deployment; local `.env.local` settings are not uploaded to GitHub.
