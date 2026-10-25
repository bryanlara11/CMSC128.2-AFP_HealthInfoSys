import { useEffect, useState } from 'react';

/** Ignore stale requests when filters, accounts or mounted pages change. */
export function useRemote<T>(load: () => Promise<T>, delay = 0) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setState(previous => ({ ...previous, loading: true, error: null }));
      void load().then(data => { if (active) setState({ data, error: null, loading: false }); })
        .catch(error => { if (active) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Could not load data.' })); });
    }, delay);
    return () => { active = false; clearTimeout(timer); };
  }, [load, revision, delay]);
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
