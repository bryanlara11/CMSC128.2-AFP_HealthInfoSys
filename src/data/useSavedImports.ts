import { useMemo, useSyncExternalStore } from 'react';
import { IMPORTS_STORAGE_KEY, readImports } from './imports';

function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === IMPORTS_STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener('storage', storage);
  window.addEventListener('afp-imports-changed', notify);
  window.addEventListener('focus', notify);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener('afp-imports-changed', notify);
    window.removeEventListener('focus', notify);
  };
}

function snapshot() {
  try { return window.localStorage.getItem(IMPORTS_STORAGE_KEY); }
  catch { return 'unavailable'; }
}

export function useSavedImports() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => {
    try { return { imports: readImports({ getItem: () => raw }), error: null }; }
    catch { return { imports: [], error: 'Saved imports could not be read. Check browser storage or return to Data Management.' }; }
  }, [raw]);
}
