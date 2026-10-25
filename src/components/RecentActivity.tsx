import { useCallback } from 'react';
import { loadAudit, describeEvent } from '../data/auditLog';
import { useRemote } from '../data/useRemote';

export function RecentActivity() {
  const load = useCallback(() => loadAudit(0, null, '', true, 6), []);
  const state = useRemote(load);
  return <section className="card p-5 space-y-3" aria-label="Your recent activity">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-primary">Your recent activity</h2><button className="btn-ghost" disabled={state.loading} onClick={state.refresh}>Refresh activity</button></div>
    {state.loading && <p role="status" className="text-sm text-text-muted">Loading activity...</p>}
    {state.error && <p role="alert" className="text-sm text-status-danger">{state.error}</p>}
    {!state.loading && !state.error && !state.data?.rows.length && <p className="text-sm text-text-muted">No activity recorded yet.</p>}
    <ul className="divide-y divide-storm-200">{state.data?.rows.map(event => <li key={event.id} className="py-3 text-sm space-y-1">
      <p className="font-medium text-primary">{event.action}</p><p className="text-text-secondary">{describeEvent(event)}</p>
      <time className="text-xs text-text-muted" dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>
    </li>)}</ul>
  </section>;
}
