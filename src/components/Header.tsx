import { ChevronDown, Shield, User, LogOut, Menu, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../data/auth';

interface HeaderProps {
  onMenuClick?: () => void;
  mobileNavOpen?: boolean;
}

export function Header({ onMenuClick, mobileNavOpen = false }: HeaderProps) {
  const { email, role, logout, authError } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowProfileMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const initials = email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    // Full-width banner. The large bottom padding leaves room for the
    // floating ModuleBar, which overlaps the bottom ~28px of this area.
    <header className="bg-primary border-b border-navy-800">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 pt-3 pb-10">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-sky-200 hover:text-cream-100 rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-400"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>

          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-forest-500 to-forest-700 items-center justify-center flex-shrink-0 ring-1 ring-white/20">
            <Shield className="w-6 h-6 text-cream-100" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold text-cream-100 tracking-tight leading-tight truncate">
              Health Surveillance and Epidemiology Unit
            </h1>
            <p className="text-xs md:text-sm text-sky-200/80 leading-snug truncate">
              Armed Forces of the Philippines Medical Corps
              <span className="hidden md:inline text-sky-200/60"> – Data for a healthier force</span>
            </p>
          </div>
        </div>

        {/* Profile */}
        <div className="relative flex-shrink-0" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 text-sm font-medium text-sky-100 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-400"
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <span className="w-8 h-8 rounded-full bg-forest-600 text-cream-100 text-xs font-semibold flex items-center justify-center">
              {initials}
            </span>
            <span className="hidden sm:inline">{role.label}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 motion-reduce:transition-none ${
                showProfileMenu ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-background-card border border-storm-200 rounded-xl shadow-card-hover overflow-hidden z-50">
              <div className="px-4 py-3 bg-storm-50 border-b border-storm-200">
                <p className="text-sm font-semibold text-text-primary">{role.label}</p>
                <p className="text-xs text-text-muted truncate">{email}</p>
              </div>
              <div className="py-1">
                <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-primary/5 focus:outline-none focus-visible:bg-primary/5">
                  <User className="w-4 h-4" aria-hidden="true" />
                  Profile
                </button>
                <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-primary/5 focus:outline-none focus-visible:bg-primary/5">
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  Settings
                </button>
              </div>
              <div className="border-t border-storm-200 py-1">
                {authError && (
                  <p role="alert" className="px-4 py-2 text-xs text-status-danger">
                    {authError}
                  </p>
                )}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-status-danger hover:bg-red-50 focus:outline-none focus-visible:bg-red-50"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}