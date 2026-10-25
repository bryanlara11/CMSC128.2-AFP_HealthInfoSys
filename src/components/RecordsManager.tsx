import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil, X } from 'lucide-react';
import { listRecords, updateRecord, type SurveillanceRecord } from '../data/recordRepository';
import { UPLOAD_HEADERS, isMissing } from '../data/workbook';
import { useRemote } from '../data/useRemote';
import type { ExcelCell } from '../data/excelTypes';

function RecordEditor({ record, headers, editable, onClose, onSaved }: {
  record: SurveillanceRecord; headers: string[]; editable: string[]; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(headers.map(header => [header, String(record.data[header] ?? '')])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const patch: Record<string, ExcelCell> = {};
    for (const header of editable) if (values[header] !== String(record.data[header] ?? '')) patch[header] = values[header].trim() ? values[header] : null;
    if (!Object.keys(patch).length) { setError('Change at least one editable field before saving.'); return; }
    setSaving(true); setError(null);
    try { await updateRecord(record, patch); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the record.'); }
    finally { setSaving(false); }
  };
  return <dialog ref={dialog} aria-labelledby="record-editor-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl backdrop:bg-black/60" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }}>
    <form onSubmit={event => { void save(event); }} className="space-y-4">
      <div className="flex justify-between items-start gap-3"><div><h2 id="record-editor-title" className="text-lg font-semibold text-primary">Edit surveillance record</h2><p className="text-xs text-text-muted mt-1">{record.filename} · {record.sheet} · Excel row {record.excelRow} · version {record.version}</p></div><button type="button" disabled={saving} className="btn-ghost" onClick={onClose} aria-label="Close record editor"><X className="w-5 h-5" /></button></div>
      <p className="text-sm text-text-secondary">Your role determines which fields you can change. Blank values remain missing. Saving also updates the workbook preview and records the changed field names in the audit trail.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{headers.map(header => {
        const allowed = editable.includes(header);
        return <label key={header} className="text-sm font-medium text-text-secondary">{header}{!allowed && <span className="text-xs text-text-muted ml-2">View only</span>}
          <input className="input-base mt-1 read-only:bg-storm-100" aria-label={header} value={values[header]} readOnly={!allowed} disabled={saving}
            type={header === 'AGE' ? 'number' : header === 'RP DATE' || header === 'DS DATE' ? 'date' : 'text'}
            min={header === 'AGE' ? 0 : undefined} max={header === 'AGE' ? 130 : undefined} step={header === 'AGE' ? 1 : undefined} maxLength={2000}
            onChange={event => setValues(previous => ({ ...previous, [header]: event.target.value }))} />
        </label>;
      })}</div>
      {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving record...' : 'Save record'}</button></div>
    </form>
  </dialog>;
}

export function RecordsManager({ onUpdated }: { onUpdated?: () => void }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SurveillanceRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => listRecords(page * 50, search), [page, search]);
  const state = useRemote(load, 200);
  const headers = UPLOAD_HEADERS.filter(header => state.data?.headers.includes(header));
  const onSaved = () => { setEditing(null); setMessage('Record saved. Workbook preview, validation and analytics were updated.'); state.refresh(); onUpdated?.(); };
  return <section className="card p-5 space-y-4" aria-labelledby="records-manager-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="records-manager-heading" className="font-semibold text-primary">Individual records</h2><button className="btn-secondary" disabled={state.loading || !!editing} onClick={state.refresh}>Refresh records</button></div>
    <p className="text-sm text-text-secondary">Only your permitted fields and assigned-unit records are shown. Demographic and clinical changes follow separate role permissions.</p>
    <input type="search" className="input-base sm:max-w-md" aria-label="Search individual records" placeholder="Search permitted record fields..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); setMessage(null); }} />
    {state.loading && <p role="status" className="text-sm text-text-muted">Loading records...</p>}
    {state.error && <p role="alert" className="text-sm text-status-danger">{state.error}</p>}
    {message && <p role="status" className="text-sm text-status-success">{message}</p>}
    {state.data && !state.error && <>
      <p className="text-sm text-text-muted">{state.data.total.toLocaleString()} matching records</p>
      {!state.data.rows.length ? <p className="text-sm text-text-secondary">No records match this view.</p> : <div className="table-container max-h-[32rem] overflow-auto"><table className="table-base min-w-[1400px]"><thead className="sticky top-0"><tr><th>Source</th>{headers.map(header => <th key={header} className="whitespace-nowrap">{header}</th>)}<th>Action</th></tr></thead><tbody>{state.data.rows.map(record => <tr key={record.id}>
        <td className="text-xs min-w-48"><p>{record.filename}</p><p>{record.assignedUnit}</p><p className="text-text-muted">{record.sheet}, row {record.excelRow}</p></td>
        {headers.map(header => <td key={header} className="whitespace-nowrap">{isMissing(record.data[header]) ? <span className="text-status-danger font-medium">missing</span> : String(record.data[header])}</td>)}
        <td>{state.data!.editableHeaders.length > 0 ? <button className="btn-secondary" disabled={state.loading} aria-label={`Edit record ${record.id}`} onClick={() => { setEditing(record); setMessage(null); }}><Pencil className="w-4 h-4" aria-hidden="true" />Edit</button> : <span className="text-xs text-text-muted">View only</span>}</td>
      </tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center gap-3 text-sm"><button className="btn-secondary" disabled={state.loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous records</button><span>Page {page + 1} of {Math.max(1, Math.ceil(state.data.total / 50))}</span><button className="btn-secondary" disabled={state.loading || (page + 1) * 50 >= state.data.total} onClick={() => setPage(value => value + 1)}>Next records</button></div>
    </>}
    {editing && state.data && <RecordEditor record={editing} headers={headers} editable={state.data.editableHeaders} onClose={() => setEditing(null)} onSaved={onSaved} />}
  </section>;
}
