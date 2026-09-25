import { Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { TourTrigger } from './OnboardingTour';

type ModuleTab = 'home' | 'data-management' | 'analysis-export' | 'account-settings';

interface ModuleBarProps {
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  onStartTour: () => void;
}

const tabs: { id: ModuleTab; label: string; icon?: React.ReactNode }[] = [
  { id: 'home', label: 'Home' },
  { id: 'data-management', label: 'DATA MANAGEMENT' },
  { id: 'analysis-export', label: 'ANALYSIS & EXPORT' },
  { id: 'account-settings', label: 'ACCOUNT SETTINGS' },
];

export function ModuleBar({ activeTab, onTabChange, onStartTour }: ModuleBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchSuggestions = [
    'Dengue cases NCR',
    'Influenza surveillance week 35',
    'Leptospirosis outbreak Luzon',
    'COVID-19 vaccination rates',
    'Measles elimination report',
    'AFP hospital bed capacity',
  ].filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSearchFocus = () => {
    if (searchQuery) setShowSearchSuggestions(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchSuggestions(value.length > 0);
  };

  const handleSearchSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSearchSuggestions(false);
  };

  return (
    <nav className="sticky top-16 z-30 bg-background-card border-b border-storm-200" role="navigation" aria-label="Main modules">
      <div className="px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Module Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1 lg:pb-0" role="tablist" aria-label="Application modules" data-tour="module-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-cream-100 shadow-sm'
                    : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <TourTrigger onStart={onStartTour} />
            <div className="relative w-full lg:w-64" ref={searchRef}>
            <div className="relative">
              <label htmlFor="global-search" className="sr-only">Search reports, diseases, or location</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" aria-hidden="true" />
                <input
                  id="global-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                  placeholder="Search reports, diseases, or location..."
                  className="input-base pl-10 pr-10"
                  aria-autocomplete="list"
                  aria-controls="search-suggestions"
                  aria-expanded={showSearchSuggestions && searchSuggestions.length > 0}
                />
              </div>
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <ul
                  id="search-suggestions"
                  role="listbox"
                  className="absolute top-full left-0 right-0 mt-1 bg-background-card border border-storm-200 rounded-lg shadow-card-hover overflow-hidden z-20"
                >
                  {searchSuggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        onClick={() => handleSearchSelect(suggestion)}
                        role="option"
                        className="w-full px-3 py-2 text-sm text-text-primary hover:bg-primary/5 text-left transition-colors"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}