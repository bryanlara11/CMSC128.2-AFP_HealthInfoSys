import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../data/auth';
import { WorkbookTables } from '../components/WorkbookTables';
import { uploadExcel, type ExcelUploadResult } from '../data/api';
import { dataSheets } from '../data/workbook';
import { readImports, writeImports, recordCount, type SavedImport } from '../data/imports';
import {
  downloadExcelTemplate, validateRows, buildErrorBatch, defectLabel,
  ERROR_BATCH_SIZE,
  type ValidationResult,
} from '../data/pipeline';
import {
  Upload, FileSpreadsheet, Download, XCircle,
  Loader2, History, Database, FileCheck2,
  ChevronRight, Table2, FileUp, Trash2, Pencil,
  Lock, FlaskConical,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

type Section = 'import' | 'history' | 'records';

export function DataManagementPage() {
  const { canUpload, role } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('import');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done'>('idle');
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState<ValidationResult | null>(null);
  const [saved, setSaved] = useState<{ entries: SavedImport[]; error: string | null }>(() => {
    try {
      return { entries: typeof window === 'undefined' ? [] : readImports(window.localStorage), error: null };
    } catch {
      return { entries: [], error: 'Could not read saved imports from this browser.' };
    }
  });
  const imports = saved.entries;
  const [currentImportId, setCurrentImportId] = useState<string | null>(imports[0]?.id ?? null);
  const [workbook, setWorkbook] = useState<ExcelUploadResult | null>(imports[0]?.workbook ?? null);
  const uploadRequest = useRef<AbortController | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const importRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const recordsRef = useRef<HTMLDivElement | null>(null);

  const goto = (s: Section) => {
    setActiveSection(s);
    const ref = s === 'import' ? importRef : s === 'history' ? historyRef : recordsRef;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* Table 5 "Error Batch": run the real rule-based validator over 30 malformed
     records rather than faking a result from the filename. */
  const runErrorBatch = useCallback(() => {
    setBatch(validateRows(buildErrorBatch()));
  }, []);

  const accept = async (f: File) => {
    if (!canUpload()) return;
    uploadRequest.current?.abort();
    const controller = new AbortController();
    uploadRequest.current = controller;
    setParseError(null);
    setFile(f);
    setPhase('parsing');
    setBatch(null);
    setWorkbook(null);
    setCurrentImportId(null);
    try {
      const uploaded = await uploadExcel(f, controller.signal);
      if (!controller.signal.aborted) {
        setWorkbook(uploaded);
        setPhase('done');
        const entry: SavedImport = {
          id: crypto.randomUUID(), dateImported: new Date().toISOString(),
          importedBy: role.label, workbook: uploaded,
        };
        const entries = [entry, ...imports];
        try {
          writeImports(window.localStorage, entries);
          setSaved({ entries, error: null });
          setCurrentImportId(entry.id);
        } catch {
          setSaved((previous) => ({ ...previous, error: 'The file was uploaded, but could not be saved in this browser. Browser storage may be full or unavailable. Its preview is available until you leave this page.' }));
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setParseError(error instanceof Error ? error.message : 'Could not upload that file.');
        setPhase('idle');
      }
    }
  };

  useEffect(() => () => uploadRequest.current?.abort(), []);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const removeImport = (id: string) => {
    if (!canUpload()) return;
    const entries = imports.filter((entry) => entry.id !== id);
    try {
      writeImports(window.localStorage, entries);
      setSaved({ entries, error: null });
      if (currentImportId === id) {
        setCurrentImportId(null);
        setWorkbook(null);
        setFile(null);
        setPhase('idle');
      }
    } catch {
      setSaved((previous) => ({ ...previous, error: 'Could not remove the import from browser storage. Please try again.' }));
    }
  };

  const filtered = imports.filter(
    (r) =>
      !search ||
      r.workbook.filename.toLowerCase().includes(search.toLowerCase()) ||
      r.importedBy.toLowerCase().includes(search.toLowerCase()),
  );

  const cards: { id: Section; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'import', label: 'Import Data', desc: 'Upload a standardized workbook', icon: <FileUp className="w-5 h-5" aria-hidden="true" /> },
    { id: 'history', label: 'Import History', desc: 'Review previous uploads', icon: <History className="w-5 h-5" aria-hidden="true" /> },
    { id: 'records', label: 'Manage Records', desc: 'Review browser-stored records', icon: <Database className="w-5 h-5" aria-hidden="true" /> },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Sub-header */}
      <header>
        <h1 className="text-2xl font-bold text-primary">Data Management</h1>
        <p className="text-text-secondary mt-1">Upload standardized Excel files and view their contents</p>
      </header>

      {/* Navigation action cards */}
      <nav aria-label="Data management sections" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => {
          const on = activeSection === c.id;
          return (
            <button
              key={c.id}
              onClick={() => goto(c.id)}
              aria-current={on ? 'true' : undefined}
              className={`card p-4 text-left flex items-center gap-3 transition-colors ${
                on ? 'ring-2 ring-accent-teal bg-accent-teal/5' : 'hover:bg-primary/5'
              }`}
            >
              <span className={`p-2.5 rounded-lg flex-shrink-0 ${on ? 'bg-accent-teal/10 text-accent-teal' : 'bg-storm-200/60 text-text-secondary'}`}>
                {c.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-primary">{c.label}</span>
                <span className="block text-xs text-text-muted mt-0.5">{c.desc}</span>
              </span>
              <ChevronRight className={`w-4 h-4 flex-shrink-0 ${on ? 'text-accent-teal' : 'text-text-muted'}`} aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      {/* 2. Excel upload center */}
      <section ref={importRef} data-tour="dropzone" className="scroll-mt-28" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="sr-only">Excel upload center</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) void accept(f); }}
            className={`lg:col-span-2 card border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
              dragActive ? 'border-accent-teal bg-accent-teal/5' : 'border-storm-200'
            }`}
          >
            <span className="w-16 h-16 rounded-2xl bg-forest-600/10 text-forest-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-9 h-9" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold text-primary">Upload Standardized Excel File</h3>
            <p className="text-sm text-text-secondary mt-1.5">
              {canUpload()
                ? 'Drag and drop your file here, or click to browse'
                : `Uploading is restricted. "${role.label}" has ${role.grants.audit === 'view' ? 'view-only' : 'no'} rights on system control.`}
            </p>
            {canUpload() ? (
              <label className="btn-primary mt-5 cursor-pointer">
                <Upload className="w-4 h-4" aria-hidden="true" />
                Browse Files
                <input
                  type="file"
                  accept=".xlsx"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void accept(f); }}
                />
              </label>
            ) : (
              <span className="btn-primary mt-5 opacity-50 cursor-not-allowed" aria-disabled="true">
                <Lock className="w-4 h-4" aria-hidden="true" />
                Browse Files
              </span>
            )}
            <p className="text-xs text-text-muted mt-3">.xlsx &middot; maximum 5 MB</p>
          </div>

          {/* Side card */}
          <aside className="card p-6 flex flex-col">
            <span className="w-11 h-11 rounded-lg bg-accent-teal/10 text-accent-teal flex items-center justify-center mb-3">
              <FileCheck2 className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold text-primary">Use the Standard Template</h3>
            <p className="text-sm text-text-secondary mt-1.5 flex-1">
              Use the standardized seven-column Excel format for surveillance uploads.
              Your file is uploaded automatically when selected or dropped here.
            </p>
            <button onClick={downloadExcelTemplate} className="btn-secondary w-full justify-center mt-4">
              <Download className="w-4 h-4" aria-hidden="true" />
              Download Template
            </button>
            <p className="text-xs text-text-muted mt-2 text-center">
              7 surveillance columns &middot; Excel workbook
            </p>
            <button
              onClick={runErrorBatch}
              className="btn-ghost w-full justify-center mt-3 text-xs"
              title="Validate 30 malformed records (Table 5 error batch)"
            >
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
              Run {ERROR_BATCH_SIZE}-record error batch
            </button>
          </aside>
        </div>
      </section>

      {/* Parse failure */}
      {parseError && (
        <section className="card p-5 border-status-danger/40" aria-live="assertive">
          <h2 className="text-base font-semibold text-primary flex items-center gap-2">
            <XCircle className="w-5 h-5 text-status-danger" aria-hidden="true" />
            Could not upload {file?.name}
          </h2>
          <p className="text-sm text-text-secondary mt-1.5">{parseError}</p>
          <p className="text-xs text-text-muted mt-2">
            Check the file and try again.
          </p>
        </section>
      )}

      <div role="status" aria-live="polite">
        {phase === 'parsing' && (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Uploading {file?.name} and reading worksheets...
          </p>
        )}
        {workbook && <p className="text-sm text-status-success">{workbook.filename}: {dataSheets(workbook).length} data worksheet(s) loaded.</p>}
      </div>
      {saved.error && <p role="alert" className="text-sm text-status-danger">{saved.error}</p>}
      {workbook && <WorkbookTables key={currentImportId ?? workbook.filename} workbook={workbook} />}

      {/* Table 5 error batch report */}
      {batch && (
        <section className="card p-6" aria-labelledby="batch-heading">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 id="batch-heading" className="text-base font-semibold text-primary">
                Error Batch Report &mdash; {ERROR_BATCH_SIZE} malformed records
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Table 5 pilot target. Undated, duplicate IDs and missing required columns, run
                through the Table 1 validator as a separate demonstration.
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-xl font-bold tabular-nums text-status-danger">{batch.errorCount}</p>
                <p className="text-[11px] text-text-muted">errors</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums text-status-warning">{batch.warningCount}</p>
                <p className="text-[11px] text-text-muted">warnings</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums text-text-primary">{batch.rejected}</p>
                <p className="text-[11px] text-text-muted">rows blocked</p>
              </div>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2">
            {(['undated', 'duplicate-id', 'missing-required', 'schema'] as const).map((d) => {
              const n = batch.issues.filter((i) => i.defect === d).length;
              if (!n) return null;
              return (
                <li key={d} className="badge-info font-mono">
                  {defectLabel(d)}: {n}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 max-h-56 overflow-y-auto border border-storm-200 rounded-lg">
            <table className="w-full text-xs">
              <caption className="sr-only">Validation issues by row</caption>
              <thead className="sticky top-0 bg-storm-100">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Row</th>
                  <th scope="col" className="px-3 py-2 text-left">Field</th>
                  <th scope="col" className="px-3 py-2 text-left">Defect</th>
                  <th scope="col" className="px-3 py-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-storm-200">
                {batch.issues.map((iss, i) => (
                  <tr key={`${iss.row}-${iss.field}-${i}`}>
                    <td className="px-3 py-1.5 font-mono tabular-nums">{iss.row}</td>
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{iss.field}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={iss.severity === 'error' ? 'badge-danger' : 'badge-warning'}>
                        {defectLabel(iss.defect)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-text-secondary">{iss.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4. Recent imports */}
      <section ref={historyRef} className="card scroll-mt-28" aria-labelledby="recent-heading">
        <div className="p-5 border-b border-storm-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 id="recent-heading" className="text-base font-semibold text-primary">Recent Imports</h2>
            <p className="text-xs text-text-muted mt-1">Saved in this browser. Select a file name to view its tables.</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file or importer..."
            className="input-base sm:w-72"
            aria-label="Search recent imports"
          />
        </div>

        <div className="table-container border-0 rounded-none">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">File Name</th>
                <th scope="col">Date Imported</th>
                <th scope="col" className="text-right">Records</th>
                <th scope="col">Status</th>
                <th scope="col">Imported By</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">
                    <button type="button" className="text-primary underline hover:no-underline disabled:opacity-50"
                      disabled={phase === 'parsing'}
                      onClick={() => { setWorkbook(r.workbook); setCurrentImportId(r.id); setParseError(null); setPhase('done'); }}>
                      {r.workbook.filename}
                    </button>
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">{new Date(r.dateImported).toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums">{recordCount(r.workbook).toLocaleString()}</td>
                  <td><span className="badge-success">Saved in browser</span></td>
                  <td className="whitespace-nowrap">{r.importedBy}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => removeImport(r.id)}
                      disabled={!canUpload() || phase === 'parsing'}
                      className="btn-secondary text-status-danger disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Remove ${r.workbook.filename}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr>
                <td colSpan={6} className="text-center text-text-muted py-8">
                  {imports.length === 0 ? 'No imports yet. Upload an Excel file to get started.' : 'No imports match your search.'}
                </td>
              </tr>}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-storm-200 text-sm text-text-secondary">
          Showing {filtered.length} of {imports.length} imports
        </div>
      </section>

      {/* 5. Manage records */}
      <section ref={recordsRef} className="card scroll-mt-28" aria-labelledby="records-heading">
        <div className="p-5 border-b border-storm-200 flex items-center gap-2">
          <Table2 className="w-5 h-5 text-text-secondary" aria-hidden="true" />
          <h2 id="records-heading" className="text-base font-semibold text-primary">Manage Records</h2>
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {imports.reduce((total, entry) => total + recordCount(entry.workbook), 0).toLocaleString()} records
            {' '}across {imports.length} imports are saved in this browser. Remove an import above to delete its saved data.
          </p>
          <div className="flex items-center gap-2">
            <button disabled className="btn-secondary opacity-50 cursor-not-allowed" title="Record editing will be available when the database is connected">
              <Pencil className="w-4 h-4" aria-hidden="true" />
              Bulk edit
            </button>
            <button disabled className="btn-secondary text-status-danger border-status-danger/40 opacity-50 cursor-not-allowed" title="Use Remove in Recent Imports to delete a saved workbook">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete records
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
