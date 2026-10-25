import { AlertCircle } from 'lucide-react';
import type { ImportStatus as Status } from '../data/workbook';

export function ImportStatus({ status, reasons = [] }: { status: Status; reasons?: string[] }) {
  const label = status[0].toUpperCase() + status.slice(1);
  return <span className="inline-flex items-center gap-2">
    <span className={status === 'complete' ? 'badge-success' : status === 'incomplete' ? 'badge-warning' : 'badge-danger'}>{label}</span>
    {reasons.length > 0 && <span className="group relative inline-flex">
      <button type="button" className={`rounded focus:outline-none focus:ring-2 focus:ring-primary ${status === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}
        title={reasons.join(' ')} aria-label={`${label}: ${reasons.join(' ')}`}>
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 max-h-48 overflow-y-auto rounded-lg bg-white p-3 text-left text-xs font-normal text-text-primary shadow-card-hover border border-storm-200 group-hover:block group-focus-within:block">
        {reasons.join(' ')}
      </span>
    </span>}
  </span>;
}
