import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../data/auth';
import { RecordsManager } from '../components/RecordsManager';
import { WorkbookTables } from '../components/WorkbookTables';
import { ImportStatus } from '../components/ImportStatus';
import { parseExcelFile } from '../data/excel';
import { listImports, saveImport, deleteImport } from '../data/importRepository';
import { UPLOAD_HEADERS } from '../data/workbook';
import { importValidation, type SavedImport } from '../data/imports';
import { downloadExcelTemplate } from '../data/excelTemplate';
import {
  Upload, FileSpreadsheet, Download, Loader2, History, Database,
  FileCheck2, ChevronRight, Table2, FileUp, Trash2, Lock,
} from 'lucide-react';

type Section = 'import' | 'history' | 'records';

export function DataManagementPage() {
  const { canUpload, canDeleteImports, role, email, profile } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('import');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<{ entries: SavedImport[]; error: string | null }>({ entries: [], error: null });
  const [pendingPreview, setPendingPreview] = useState<SavedImport | null>(null);
  const imports = saved.entries;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pendingPreview ?? imports.find(entry => entry.id === selectedId);
  const busy = useRef(false);
  const uploadRequest = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const recordsRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (preferredId?: string) => {
    setLoadingHistory(true);
    try {
      const entries = await listImports();
      setSaved({ entries, error: null });
      setSelectedId(previous => preferredId ?? (entries.some(entry => entry.id === previous) ? previous : entries[0]?.id ?? null));
      return true;
    } catch (error) {
      setSaved(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Could not load import history from Supabase.' }));
      return false;
    } finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => {
    if (role.grants.audit === 'no-access') return;
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => { clearTimeout(timer); uploadRequest.current?.abort(); };
  }, [refresh, role.grants.audit]);

  const goto = (section: Section) => {
    setActiveSection(section);
    const ref = section === 'import' ? importRef : section === 'history' ? historyRef : recordsRef;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const accept = async (file: File) => {
    if (!canUpload() || busy.current || loadingHistory || deleting) return;
    busy.current = true;
    const controller = new AbortController();
    uploadRequest.current = controller;
    setUploading(file.name);
    const entry: SavedImport = {
      id: '', dateImported: new Date().toISOString(), importedBy: profile.fullName,
      uploader: { ...profile, email, role: role.label }, workbook: { filename: file.name, sheets: [] },
    };
    try {
      try { entry.workbook = await parseExcelFile(file, controller.signal); }
      catch (error) {
        if (controller.signal.aborted) return;
        entry.error = error instanceof Error ? error.message : 'Could not read this file.';
      }
      if (controller.signal.aborted) return;
      setPendingPreview(entry);
      const id = await saveImport(entry.workbook, entry.error);
      if (controller.signal.aborted) return;
      setPendingPreview(null);
      const loaded = await refresh(id);
      if (!loaded) setSaved(previous => ({ ...previous, error: 'The import was saved to Supabase, but history could not be refreshed. Use Refresh history to reload it.' }));
    } catch (error) {
      if (!controller.signal.aborted) setSaved(previous => ({ ...previous, error: `Import was not saved to Supabase. ${error instanceof Error ? error.message : 'Please try again.'}` }));
    } finally { busy.current = false; if (!controller.signal.aborted) setUploading(null); }
  };

  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', prevent); window.addEventListener('drop', prevent);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, []);

  const removeImport = async (id: string) => {
    if (!canDeleteImports() || busy.current) return;
    busy.current = true; setDeleting(id);
    try {
      await deleteImport(id);
      setSaved(previous => ({ entries: previous.entries.filter(entry => entry.id !== id), error: null }));
      setSelectedId(previous => previous === id ? null : previous);
    } catch (error) { setSaved(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Could not delete the import.' })); }
    finally { busy.current = false; setDeleting(null); }
  };

  const filtered = imports.filter(entry => [entry.workbook.filename, entry.importedBy, entry.uploader?.assignedUnit ?? ''].some(value => value.toLowerCase().includes(search.toLowerCase())));
  if (role.grants.audit === 'no-access') return <div className="space-y-6"><h1 className="text-2xl font-bold text-primary">Data Management</h1><RecordsManager /></div>;
  const cards = [
    { id: 'import' as const, label: 'Import Data', desc: 'Upload a standardized workbook', icon: FileUp },
    { id: 'history' as const, label: 'Import History', desc: 'Review previous uploads', icon: History },
    { id: 'records' as const, label: 'Manage Records', desc: 'Review uploaded records', icon: Database },
  ];

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-bold text-primary">Data Management</h1>
      <p className="text-text-secondary mt-1">Upload standardized surveillance workbooks and review data quality</p>
    </header>
    <nav aria-label="Data management sections" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(({ id, label, desc, icon: Icon }) => <button key={id} onClick={() => goto(id)} aria-current={activeSection === id ? 'true' : undefined}
        className={`card p-4 text-left flex items-center gap-3 transition-colors ${activeSection === id ? 'ring-2 ring-accent-teal bg-accent-teal/5' : 'hover:bg-primary/5'}`}>
        <span className="p-2.5 rounded-lg bg-primary/10 text-primary"><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-primary">{label}</span><span className="block text-xs text-text-muted mt-0.5">{desc}</span></span>
        <ChevronRight className="w-4 h-4 text-text-muted" aria-hidden="true" />
      </button>)}
    </nav>
    <section ref={importRef} data-tour="dropzone" className="scroll-mt-64" aria-label="Excel upload center">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)}
          onDrop={event => { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files[0]; if (file) void accept(file); }}
          className={`lg:col-span-2 card border-2 border-dashed p-8 flex flex-col items-center justify-center text-center ${dragActive ? 'border-accent-teal bg-accent-teal/5' : 'border-storm-200'}`}>
          <span className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><FileSpreadsheet className="w-9 h-9" aria-hidden="true" /></span>
          <h2 className="text-lg font-semibold text-primary">Upload Standardized Excel File</h2>
          <p className="text-sm text-text-secondary mt-1.5">{canUpload() ? 'Drag and drop your file here, or click to browse' : `Uploading is restricted. "${role.label}" does not have upload permission.`}</p>
          {canUpload() ? <label className="btn-primary mt-5 cursor-pointer"><Upload className="w-4 h-4" aria-hidden="true" />Browse Files
            <input type="file" accept=".xlsx" disabled={!!uploading || loadingHistory || !!deleting} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void accept(file); }} />
          </label> : <span className="btn-primary mt-5 opacity-50 cursor-not-allowed" aria-disabled="true"><Lock className="w-4 h-4" aria-hidden="true" />Browse Files</span>}
          <p className="text-xs text-text-muted mt-3">.xlsx · maximum 5 MB · 14 standardized columns</p>
          <p className="text-sm text-text-secondary mt-4">Assigned unit: <strong>{profile.assignedUnit}</strong></p>
          <p className="text-xs text-text-muted mt-1">Your administrator assigns your unit. Staff can review imports from their assigned unit.</p>
        </div>
        <aside className="card p-6 flex flex-col">
          <FileCheck2 className="w-9 h-9 text-primary mb-3" aria-hidden="true" />
          <h3 className="text-base font-semibold text-primary">Use the Standard Template</h3>
          <p className="text-sm text-text-secondary mt-1.5">Use these 14 columns in order. Reference sheets are excluded from surveillance records.</p>
          <p className="text-xs text-text-secondary leading-6 mt-3">{UPLOAD_HEADERS.join(' · ')}</p>
          <button onClick={downloadExcelTemplate} className="btn-secondary w-full justify-center mt-4">
            <Download className="w-4 h-4" aria-hidden="true" />Download Template
          </button>
          <p className="text-xs text-text-muted mt-3">Complete: all values present. Incomplete: blank values or no records. Error: incorrect columns or an upload failure.</p>
        </aside>
      </div>
    </section>
    <div role="status" aria-live="polite">{uploading && <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Uploading {uploading} and checking worksheets...</p>}</div>
    {saved.error && <p role="alert" className="text-sm text-status-danger">{saved.error}</p>}
    {pendingPreview && <p role="status" className="text-sm text-text-secondary">This is a local preview. The import is not in database history until saving succeeds.</p>}
    {selected && (selected.metadataOnly ? <section className="card p-6 space-y-3" aria-label="Import validation details">
      <h2 className="text-lg font-semibold text-primary">Import validation details</h2>
      <p>{selected.workbook.filename}</p><ImportStatus status={importValidation(selected).status} reasons={importValidation(selected).reasons} />
      <p className="text-sm text-text-secondary">Your role can review ingestion errors for {selected.uploader?.assignedUnit}. Patient rows are restricted.</p>
      <p className="text-sm text-status-danger">{importValidation(selected).reasons.join(' ')}</p>
    </section> : <WorkbookTables key={selected.id || 'pending'} workbook={selected.workbook} uploader={selected.uploader} error={selected.error} />)}
    <section ref={historyRef} className="card scroll-mt-64" aria-labelledby="recent-heading">
      <div className="p-5 border-b border-storm-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 id="recent-heading" className="text-base font-semibold text-primary">Recent Imports</h2><p className="text-xs text-text-muted mt-1">Select a file name to view its tables.</p>
          <button type="button" className="btn-ghost mt-1" disabled={loadingHistory || !!uploading || !!deleting} onClick={() => { void refresh(); }}>{loadingHistory ? 'Loading history...' : 'Refresh history'}</button>
        </div>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search file, uploader or unit..." className="input-base sm:w-72" aria-label="Search recent imports" />
      </div>
      <div className="table-container border-0 rounded-none">
        <table className="table-base min-w-[1100px]"><thead><tr>
          <th scope="col">File Name</th><th scope="col">Date Imported</th><th scope="col" className="text-right">Records</th><th scope="col">Status</th><th scope="col">Imported By / Assigned Unit</th><th scope="col" className="text-right">Actions</th>
        </tr></thead><tbody>
          {filtered.map(entry => {
            const validation = importValidation(entry);
            return <tr key={entry.id}>
              <td className="min-w-64"><button type="button" className={`font-mono text-xs underline hover:no-underline break-all ${validation.status === 'error' ? 'text-status-danger' : 'text-primary'}`} disabled={!!uploading} onClick={() => { setPendingPreview(null); setSelectedId(entry.id); }}>{entry.workbook.filename}</button></td>
              <td className="whitespace-nowrap text-text-secondary">{new Date(entry.dateImported).toLocaleString()}</td>
              <td className="text-right font-mono tabular-nums">{validation.status === 'error' ? 0 : validation.recordCount.toLocaleString()}</td>
              <td><ImportStatus status={validation.status} reasons={validation.reasons} /></td>
              <td><p>{entry.uploader?.fullName ?? entry.importedBy}</p><p className="text-xs text-text-muted">{entry.uploader?.assignedUnit ?? 'Unit not recorded'}</p></td>
              <td className="text-right">{canDeleteImports() && <button type="button" onClick={() => { void removeImport(entry.id); }} disabled={!!uploading || !!deleting} className="btn-secondary text-status-danger disabled:opacity-50 disabled:cursor-not-allowed" aria-label={`Remove ${entry.workbook.filename}`}><Trash2 className="w-4 h-4" aria-hidden="true" />{deleting === entry.id ? 'Removing...' : 'Remove'}</button>}</td>
            </tr>;
          })}
          {!filtered.length && <tr><td colSpan={6} className="text-center text-text-muted py-8">{loadingHistory ? 'Loading imports from Supabase...' : imports.length ? 'No imports match your search.' : 'No imports available for your role and assigned unit.'}</td></tr>}
        </tbody></table>
      </div>
      <div className="p-4 border-t border-storm-200 text-sm text-text-secondary">Showing {filtered.length} of {imports.length} imports</div>
    </section>
    <section ref={recordsRef} className="card scroll-mt-64" aria-labelledby="records-heading">
      <div className="p-5 border-b border-storm-200 flex items-center gap-2"><Table2 className="w-5 h-5 text-text-secondary" aria-hidden="true" /><h2 id="records-heading" className="text-base font-semibold text-primary">Manage Records</h2></div>
      <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-text-secondary">{imports.reduce((total, entry) => { const validation = importValidation(entry); return total + (validation.status === 'error' ? 0 : validation.recordCount); }, 0).toLocaleString()} records across {imports.length} accessible imports in Supabase. Files with column errors are excluded from record totals.</p>
      </div>
      {role.id !== 'hseu-analyst' && <RecordsManager key={imports.map(entry => entry.id).join(':')} onUpdated={() => { void refresh(); }} />}
    </section>
  </div>;
}
