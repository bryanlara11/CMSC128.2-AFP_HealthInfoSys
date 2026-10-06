import { ChevronDown, ChevronUp, Filter, Calendar, MapPin, Building2, User, Activity, Download, Save } from 'lucide-react';
import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface SidebarProps {
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onExport: () => void;
  onSaveFilter: () => void;
}

const dateRanges: FilterOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

const regions: FilterOption[] = [
  { value: 'all', label: 'All Regions' },
  { value: 'ncr', label: 'NCR', count: 1247 },
  { value: 'luzon', label: 'Luzon', count: 2891 },
  { value: 'visayas', label: 'Visayas', count: 1567 },
  { value: 'mindanao', label: 'Mindanao', count: 1123 },
];

const commands: FilterOption[] = [
  { value: 'all', label: 'All Commands' },
  { value: 'paf', label: 'Philippine Air Force', count: 892 },
  { value: 'pn', label: 'Philippine Navy', count: 756 },
  { value: 'pa', label: 'Philippine Army', count: 3289 },
  { value: 'ghq', label: 'GHQ & HSC', count: 421 },
];

const diseases: FilterOption[] = [
  { value: 'all', label: 'All Diseases' },
  { value: 'dengue', label: 'Dengue', count: 1456 },
  { value: 'influenza', label: 'Influenza', count: 987 },
  { value: 'leptospirosis', label: 'Leptospirosis', count: 567 },
  { value: 'measles', label: 'Measles', count: 234 },
  { value: 'covid19', label: 'COVID-19', count: 2134 },
  { value: 'cholera', label: 'Cholera', count: 89 },
  { value: 'typhoid', label: 'Typhoid Fever', count: 345 },
  { value: 'malaria', label: 'Malaria', count: 167 },
];

const ranks: FilterOption[] = [
  { value: 'all', label: 'All Ranks' },
  { value: 'officer', label: 'Officers', count: 1234 },
  { value: 'enlisted', label: 'Enlisted Personnel', count: 4567 },
  { value: 'civilian', label: 'Civilian Employees', count: 567 },
];

const statuses: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active Cases', count: 2341 },
  { value: 'recovered', label: 'Recovered', count: 5678 },
  { value: 'deceased', label: 'Deceased', count: 89 },
  { value: 'monitoring', label: 'Under Monitoring', count: 1123 },
];

export function Sidebar({
  onApplyFilters,
  onClearFilters,
  onExport,
  onSaveFilter,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['date', 'location', 'disease']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const renderFilterSection = (
    title: string,
    key: string,
    options: FilterOption[],
    icon: React.ReactNode,
    multiple = false
  ) => {
    const isExpanded = expandedSections.includes(key);
    return (
      <div className="border-b border-storm-200 last:border-b-0">
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-text-primary hover:bg-primary/5 transition-colors"
          aria-expanded={isExpanded}
        >
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={key}
                  value={option.value}
                  className="w-4 h-4 text-accent-teal border-storm-200 rounded focus:ring-accent-teal focus:ring-2"
                />
                <span className="text-sm text-text-primary flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-text-muted bg-storm-200 px-2 py-0.5 rounded-full">{option.count.toLocaleString()}</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      data-tour="filter-panel"
      className="hidden lg:flex w-80 shrink-0 flex-col self-start sticky top-0 h-screen bg-background-card border-r border-storm-200"
      role="complementary"
      aria-label="Filters"
    >
        {/* Header */}
        <div className="flex items-center p-4 border-b border-storm-200">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <Filter className="w-5 h-5" aria-hidden="true" />
            Filters
          </h2>
        </div>

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {renderFilterSection(
            'Date Range',
            'date',
            dateRanges,
            <Calendar className="w-4 h-4" aria-hidden="true" />
          )}
          {renderFilterSection(
            'Region',
            'location',
            regions,
            <MapPin className="w-4 h-4" aria-hidden="true" />
          )}
          {renderFilterSection(
            'Command',
            'command',
            commands,
            <Building2 className="w-4 h-4" aria-hidden="true" />
          )}
          {renderFilterSection(
            'Disease',
            'disease',
            diseases,
            <Activity className="w-4 h-4" aria-hidden="true" />
          )}
          {renderFilterSection(
            'Rank/Category',
            'rank',
            ranks,
            <User className="w-4 h-4" aria-hidden="true" />
          )}
          {renderFilterSection(
            'Case Status',
            'status',
            statuses,
            <Activity className="w-4 h-4" aria-hidden="true" />
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-storm-200 space-y-2">
          <button
            onClick={onExport}
            className="btn-primary w-full justify-center gap-2"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export Filtered Data
          </button>
          <button
            onClick={onSaveFilter}
            className="btn-secondary w-full justify-center gap-2"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            Save Filter Preset
          </button>
          <button
            onClick={onClearFilters}
            className="btn-ghost w-full justify-center text-status-danger hover:bg-red-50"
          >
            Clear All Filters
          </button>
          <button
            onClick={onApplyFilters}
            className="btn-primary w-full justify-center"
          >
            Apply Filters
          </button>
        </div>
    </aside>
  );
}