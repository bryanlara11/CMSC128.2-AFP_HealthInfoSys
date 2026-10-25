/**
 * Logs page — admin-only view of system-wide Audit Logs and Access Logs.
 *
 * Subtabs:
 *  - Audit Logs (default): all CRUD operations by every user
 *  - Access Logs: login / logout / session-expired events
 *
 * Only visible to roles with full-access on the 'audit' permission
 * (currently only I.T. Personnel per Table 4).
 */

import { useState, useMemo } from 'react';
import {
  ClipboardList, LogIn, LogOut, Clock, Search,
  Filter, ChevronDown, ChevronUp, FileText, AlertCircle,
  RefreshCw, Download,
} from 'lucide-react';
import {
  getAuditLogs, getAccessLogs,
  type AuditEntry, type AccessEntry, type AuditOperation, type AccessAction,
} from '../data/auditLog';

/* ------------------------------------------------------------------ */
/*  Sub-tab type                                                        */
/* ------------------------------------------------------------------ */

type LogSubTab = 'audit' | 'access';

/* ------------------------------------------------------------------ */
/*  Operation badge styles                                              */
/* ------------------------------------------------------------------ */

const OP_STYLE: Record<AuditOperation, string> = {
  Import:            'badge-info',
  Export:            'badge-warning',
  Edit:              'bg-amber-100 text-amber-800',
  Delete:            'badge-danger',
  View:              'bg-storm-100 text-primary',
  Create:            'badge-success',
  'Download Template': 'bg-teal-100 text-teal-800',
  Validate:          'bg-purple-100 text-purple-800',
  'Apply Filter':    'bg-storm-100 text-text-secondary',
  'Save Filter':     'bg-sky-100 text-sky-800',
  'Generate Report': 'bg-emerald-100 text-emerald-800',
};

const ACCESS_STYLE: Record<AccessAction, { cls: string; icon: typeof LogIn }> = {
  Login:            { cls: 'badge-success', icon: LogIn },
  Logout:           { cls: 'bg-storm-200 text-primary', icon: LogOut },
  'Session Expired': { cls: 'badge-warning', icon: Clock },
};

/* ------------------------------------------------------------------ */
/*  Sort helper                                                         */
/* ------------------------------------------------------------------ */
type SortDir = 'asc' | 'desc';

function SortIcon({ dir, active }: { dir: SortDir; active: boolean }) {
  return active
    ? (dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-0.5" />)
    : <ChevronDown className="w-3.5 h-3.5 inline ml-0.5 opacity-30" />;
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function LogsPage() {
  const [subTab, setSubTab] = useState<LogSubTab>('audit');

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-primary">System Logs</h1>
        <p className="text-text-secondary mt-1">
          Comprehensive audit trail of all system activity. Entries are retained for 5 years and cannot be modified.
        </p>
      </div>

      {/* Subtabs */}
      <div className="flex items-center gap-1 border-b border-storm-200">
        <button
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            subTab === 'audit'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-primary hover:border-storm-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" aria-hidden="true" />
          Audit Logs
        </button>
        <button
          onClick={() => setSubTab('access')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            subTab === 'access'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-primary hover:border-storm-200'
          }`}
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          Access Logs
        </button>
      </div>

      {/* Content */}
      {subTab === 'audit' ? <AuditLogsPanel /> : <AccessLogsPanel />}
    </div>
  );
}

/* ================================================================== */
/*  AUDIT LOGS PANEL                                                    */
/* ================================================================== */

const ALL_OPERATIONS: AuditOperation[] = [
  'Import', 'Export', 'Edit', 'Delete', 'View', 'Create',
  'Download Template', 'Validate', 'Apply Filter', 'Save Filter', 'Generate Report',
];

function AuditLogsPanel() {
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState<AuditOperation | ''>('');
  const [sortField, setSortField] = useState<'timestamp' | 'user' | 'operation'>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [, setTick] = useState(0);

  const raw = getAuditLogs();

  const entries = useMemo(() => {
    let list = [...raw] as AuditEntry[];

    /* filter by operation */
    if (opFilter) list = list.filter(e => e.operation === opFilter);

    /* search across user, unit, details */
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.user.toLowerCase().includes(q) ||
        e.unit.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q),
      );
    }

    /* sort */
    list.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [raw, search, opFilter, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search user, unit, or details…"
            className="input-base pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <select
            value={opFilter}
            onChange={e => setOpFilter(e.target.value as AuditOperation | '')}
            className="input-base w-auto pr-8"
          >
            <option value="">All Operations</option>
            {ALL_OPERATIONS.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setTick(t => t + 1)}
          className="btn-ghost gap-1.5"
          aria-label="Refresh audit logs"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Entries" value={raw.length} />
        <StatCard label="Imports" value={raw.filter(e => e.operation === 'Import').length} />
        <StatCard label="Exports" value={raw.filter(e => e.operation === 'Export').length} />
        <StatCard label="Edits / Deletes" value={raw.filter(e => e.operation === 'Edit' || e.operation === 'Delete').length} />
      </div>

      {/* Table */}
      <section className="card" aria-label="Audit log entries">
        {entries.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No audit entries match your filters.</p>
          </div>
        ) : (
          <div className="table-container border-0 rounded-none">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col" className="cursor-pointer select-none" onClick={() => toggleSort('timestamp')}>
                    Timestamp <SortIcon dir={sortDir} active={sortField === 'timestamp'} />
                  </th>
                  <th scope="col" className="cursor-pointer select-none" onClick={() => toggleSort('user')}>
                    User <SortIcon dir={sortDir} active={sortField === 'user'} />
                  </th>
                  <th scope="col">Role</th>
                  <th scope="col">Unit</th>
                  <th scope="col" className="cursor-pointer select-none" onClick={() => toggleSort('operation')}>
                    Operation <SortIcon dir={sortDir} active={sortField === 'operation'} />
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td className="font-mono text-xs whitespace-nowrap">{entry.timestamp}</td>
                    <td className="text-sm whitespace-nowrap">{entry.user}</td>
                    <td className="text-xs text-text-secondary whitespace-nowrap">{entry.role}</td>
                    <td className="text-xs text-text-secondary whitespace-nowrap">{entry.unit}</td>
                    <td>
                      <span className={`badge ${OP_STYLE[entry.operation]}`}>{entry.operation}</span>
                    </td>
                    <td className="text-xs text-text-secondary max-w-xs truncate">{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-storm-200 flex items-center justify-between">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            Showing {entries.length} of {raw.length} entries · Retained for 5 years
          </p>
          <button className="btn-ghost gap-1.5" onClick={() => {
            /* Placeholder: export audit log as CSV */
            const header = 'Timestamp,User,Role,Unit,Operation,Details';
            const rows = entries.map(e => `"${e.timestamp}","${e.user}","${e.role}","${e.unit}","${e.operation}","${e.details.replace(/"/g, '""')}"`);
            const csv = [header, ...rows].join('\r\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'audit_log_export.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  ACCESS LOGS PANEL                                                   */
/* ================================================================== */

function AccessLogsPanel() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<AccessAction | ''>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [, setTick] = useState(0);

  const raw = getAccessLogs();

  const entries = useMemo(() => {
    let list = [...raw] as AccessEntry[];

    if (actionFilter) list = list.filter(e => e.action === actionFilter);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.user.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.ip.includes(q),
      );
    }

    list.sort((a, b) => {
      const cmp = a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [raw, search, actionFilter, sortDir]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search user, role, or IP…"
            className="input-base pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as AccessAction | '')}
            className="input-base w-auto pr-8"
          >
            <option value="">All Actions</option>
            <option value="Login">Login</option>
            <option value="Logout">Logout</option>
            <option value="Session Expired">Session Expired</option>
          </select>
        </div>
        <button
          onClick={() => setTick(t => t + 1)}
          className="btn-ghost gap-1.5"
          aria-label="Refresh access logs"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Events" value={raw.length} />
        <StatCard label="Logins" value={raw.filter(e => e.action === 'Login').length} />
        <StatCard label="Logouts" value={raw.filter(e => e.action === 'Logout').length} />
        <StatCard label="Sessions Expired" value={raw.filter(e => e.action === 'Session Expired').length} />
      </div>

      {/* Table */}
      <section className="card" aria-label="Access log entries">
        {entries.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No access events match your filters.</p>
          </div>
        ) : (
          <div className="table-container border-0 rounded-none">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col" className="cursor-pointer select-none" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                    Timestamp <SortIcon dir={sortDir} active={true} />
                  </th>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Action</th>
                  <th scope="col">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const style = ACCESS_STYLE[entry.action];
                  const Icon = style.icon;
                  return (
                    <tr key={entry.id}>
                      <td className="font-mono text-xs whitespace-nowrap">{entry.timestamp}</td>
                      <td className="text-sm whitespace-nowrap">{entry.user}</td>
                      <td className="text-xs text-text-secondary whitespace-nowrap">{entry.role}</td>
                      <td>
                        <span className={`badge ${style.cls} gap-1`}>
                          <Icon className="w-3 h-3" aria-hidden="true" />
                          {entry.action}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{entry.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-storm-200 flex items-center justify-between">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            Showing {entries.length} of {raw.length} events · Retained for 5 years
          </p>
          <button className="btn-ghost gap-1.5" onClick={() => {
            const header = 'Timestamp,User,Role,Action,IP Address';
            const rows = entries.map(e => `"${e.timestamp}","${e.user}","${e.role}","${e.action}","${e.ip}"`);
            const csv = [header, ...rows].join('\r\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'access_log_export.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  Shared stat card                                                    */
/* ================================================================== */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background-card rounded-xl border border-storm-200 p-4 shadow-card">
      <p className="text-2xl font-bold tabular-nums text-primary">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}
