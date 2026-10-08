/**
 * Table 4 — role switcher.
 *
 * Exists so the access matrix is demonstrable in a prototype: pick a role and
 * watch modules and actions gate themselves. In the deployed system the role
 * comes from the authenticated account, never from a picker.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../data/auth';
import { ROLES, PERMISSION_LABELS, ACCESS_LABELS, type Permission } from '../data/dictionary';

const ORDER: Permission[] = ['demographics', 'clinicalLab', 'physicalExam', 'surveillance', 'audit'];

export function RoleSwitcher() {
  const { role, setRoleId, level } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-200 hover:text-cream-100 transition-colors rounded-lg hover:bg-white/5 border border-white/10"
        title="Simulate a role from Table 4 (prototype only)"
      >
        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline max-w-[13rem] truncate">{role.label}</span>
        <span className="sm:hidden">Role</span>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[26rem] card shadow-xl z-50 overflow-hidden" role="menu">
          <div className="px-4 py-3 border-b border-storm-200">
            <p className="text-sm font-semibold text-primary">Acting role</p>
            <p className="text-xs text-text-muted mt-0.5">
              Table 4 access matrix. Client-side only — the real system enforces this server-side.
            </p>
          </div>

          <ul className="max-h-72 overflow-y-auto divide-y divide-storm-200">
            {ROLES.map((r) => {
              const active = r.id === role.id;
              return (
                <li key={r.id}>
                  <button
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => { setRoleId(r.id); setOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-storm-100 transition-colors ${active ? 'bg-storm-100' : ''}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{r.label}</span>
                      {active && <Check className="w-4 h-4 text-forest-600 flex-shrink-0" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {ORDER.map((p) => {
                        const l = r.grants[p];
                        return (
                          <span
                            key={p}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              l === 'no-access'
                                ? 'bg-storm-100 text-text-muted'
                                : l === 'full-access'
                                  ? 'bg-forest-600/15 text-forest-600'
                                  : 'bg-accent-teal/10 text-accent-teal'
                            }`}
                            title={`${PERMISSION_LABELS[p]}: ${ACCESS_LABELS[l]}`}
                          >
                            <span className="font-semibold mr-1">{PERMISSION_LABELS[p]}:</span>
                            <span className={l === 'no-access' ? 'line-through' : ''}>{ACCESS_LABELS[l]}</span>
                          </span>
                        );
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="px-4 py-2.5 border-t border-storm-200 bg-storm-100/60">
            <p className="text-[11px] text-text-muted">
              Current: <span className="font-semibold text-text-secondary">{role.label}</span> —{' '}
              {ACCESS_LABELS[level('surveillance')]} to the surveillance dashboard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
