import { Filter, Download, Bookmark, X } from 'lucide-react';

interface SidebarProps {
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onExport: () => void;
  onSaveFilter: () => void;
}

/** Filter panel shown beside the page content when Layout's showSidebar is true. */
export function Sidebar({ onApplyFilters, onClearFilters, onExport, onSaveFilter }: SidebarProps) {
  const actionBase =
    'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <aside
      aria-label="Filters"
      className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-background-card border-r border-storm-200 p-4 gap-4"
    >
      <h2 className="text-sm font-semibold text-text-primary">Filters</h2>

      {/* Add filter controls here */}
      <div className="flex-1" />

      <div className="space-y-1.5">
        <button onClick={onApplyFilters} className={`${actionBase} bg-primary text-cream-100 hover:bg-primary/90`}>
          <Filter className="w-4 h-4" aria-hidden="true" />
          Apply filters
        </button>
        <button onClick={onClearFilters} className={`${actionBase} text-text-secondary hover:text-primary hover:bg-primary/5`}>
          <X className="w-4 h-4" aria-hidden="true" />
          Clear filters
        </button>
        <button onClick={onSaveFilter} className={`${actionBase} text-text-secondary hover:text-primary hover:bg-primary/5`}>
          <Bookmark className="w-4 h-4" aria-hidden="true" />
          Save filter
        </button>
        <button onClick={onExport} className={`${actionBase} text-text-secondary hover:text-primary hover:bg-primary/5`}>
          <Download className="w-4 h-4" aria-hidden="true" />
          Export
        </button>
      </div>
    </aside>
  );
}