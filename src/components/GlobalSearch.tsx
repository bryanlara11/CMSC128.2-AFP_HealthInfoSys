import { Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'Dengue cases NCR',
  'Influenza surveillance week 35',
  'Leptospirosis outbreak Luzon',
  'COVID-19 vaccination rates',
  'Measles elimination report',
  'AFP hospital bed capacity',
];

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const suggestions = SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase()));
  const expanded = open && suggestions.length > 0;

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(value.length > 0);
  };

  const handleSelect = (suggestion: string) => {
    setQuery(suggestion);
    setOpen(false);
  };

  return (
    <div className="relative w-40 sm:w-56 lg:w-64" ref={containerRef}>
      <label htmlFor="global-search" className="sr-only">
        Search reports, diseases, or location
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="global-search"
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query && setOpen(true)}
        placeholder="Search..."
        className="input-base pl-10 pr-3"
        aria-autocomplete="list"
        aria-controls="search-suggestions"
        aria-expanded={expanded}
      />
      {expanded && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute top-full right-0 mt-2 w-72 max-w-[85vw] bg-background-card border border-storm-200 rounded-xl shadow-card-hover overflow-hidden z-50"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion} role="presentation">
              <button
                onClick={() => handleSelect(suggestion)}
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2 text-sm text-text-primary hover:bg-primary/5 text-left transition-colors focus:outline-none focus-visible:bg-primary/5"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}