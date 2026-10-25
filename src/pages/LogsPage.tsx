import { useCallback, useState } from 'react';
import { loadAudit, describeEvent } from '../data/auditLog';
import { useRemote } from '../data/useRemote';

export function LogsPage() {
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(() => loadAudit(page * 50, category || null, search), [page, category, search]);
  const state = useRemote(load, 200);
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-primary">System Logs</h1><p className="text-text-secondary mt-1">Persistent audit and access events from Supabase. Application accounts cannot modify or delete these entries.</p></header>
    <section className="card p-5 space-y-4" aria-label="Persistent audit log">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm flex-1 min-w-48">Search audit events<input className="input-base mt-1" type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
        <label className="text-sm">Event type<select aria-label="Event type" className="input-base mt-1" value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">All events</option><option value="audit">Audit events</option><option value="access">Access events</option></select></label>
        <button className="btn-secondary" disabled={state.loading} onClick={state.refresh}>Refresh logs</button>
      </div>
      {state.loading && <p role="status" className="text-sm text-text-muted">Loading audit events...</p>}
      {state.error && <p role="alert" className="text-sm text-status-danger">{state.error}</p>}
      {state.data && !state.error && <>
        <p className="text-sm text-text-muted">{state.data.total.toLocaleString()} matching events. Times are shown in your local timezone.</p>
        {!state.data.rows.length ? <p className="text-sm text-text-secondary">No audit events match this view.</p> : <div className="table-container"><table className="table-base min-w-[1000px]"><thead><tr><th>Timestamp</th><th>User / Role</th><th>Assigned unit</th><th>Action</th><th>Details</th></tr></thead><tbody>{state.data.rows.map(event => <tr key={event.id}>
          <td className="whitespace-nowrap text-xs">{new Date(event.timestamp).toLocaleString()}</td><td><p>{event.actorName}</p><p className="text-xs text-text-muted">{event.email}</p><p className="text-xs">{event.role}</p></td><td>{event.unit}</td><td><span className="badge-info">{event.action}</span></td><td className="text-xs">{describeEvent(event)}{event.entityId && <p className="text-text-muted mt-1">{event.entityType} {event.entityId}</p>}</td>
        </tr>)}</tbody></table></div>}
        <div className="flex gap-3 items-center text-sm"><button className="btn-secondary" disabled={state.loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous events</button><span>Page {page + 1} of {Math.max(1, Math.ceil(state.data.total / 50))}</span><button className="btn-secondary" disabled={state.loading || (page + 1) * 50 >= state.data.total} onClick={() => setPage(value => value + 1)}>Next events</button></div>
      </>}
    </section>
  </div>;
}
