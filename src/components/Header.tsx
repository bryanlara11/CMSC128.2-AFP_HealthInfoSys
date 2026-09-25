import { ChevronDown, Shield, User, LogOut, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { RoleSwitcher } from './RoleSwitcher';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(!showProfileMenu);
  };

  return (
    <header className="sticky top-0 z-40 bg-primary border-b border-navy-800">
      {/* Top Utility Bar */}
      <div className="hidden md:flex items-center justify-between px-6 py-2 bg-navy-800 border-b border-navy-800/50">
        <div className="flex items-center gap-6 text-sm font-medium text-sky-200 tracking-wide">
          <span className="flex items-center gap-1.5 text-forest-600">
            <Shield className="w-4 h-4" aria-hidden="true" />
            PREVENT
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5">
            DETECT
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5">
            RESPOND
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5">
            PROTECT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-200 hover:text-cream-100 transition-colors rounded-lg hover:bg-white/5"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
            >
              <User className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Juan Dela Cruz</span>
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-background-card border border-storm-200 rounded-lg shadow-card-hover py-1">
                <div className="px-3 py-2 border-b border-storm-200">
                  <p className="text-sm font-medium text-text-primary">Juan Dela Cruz</p>
                  <p className="text-xs text-text-muted">HSEU Personnel</p>
                </div>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-primary/5">
                  <User className="w-4 h-4" aria-hidden="true" />
                  Profile
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-primary/5">
                  <Shield className="w-4 h-4" aria-hidden="true" />
                  Settings
                </button>
                <hr className="my-1 border-storm-200" />
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-danger hover:bg-red-50">
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Utility Bar */}
      <div className="md:hidden px-4 py-2 bg-navy-800 border-b border-navy-800/50">
        <div className="flex items-center justify-between">
          <button
            onClick={onMenuClick}
            className="p-2 text-sky-200 hover:text-cream-100 rounded-lg hover:bg-white/5"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-xs font-medium text-sky-200 tracking-wider">PREVENT | DETECT | RESPOND | PROTECT</span>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Branding Bar */}
      <div className="px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-forest-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-cream-100" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-cream-100 tracking-tight">
                ARMED FORCES OF THE PHILIPPINES MEDICAL CORPS
              </h1>
              <p className="text-sm font-medium text-sky-200">Health Surveillance and Epidemiology Unit</p>
              <p className="text-xs text-sky-200/80 tracking-wider uppercase">DATA FOR A HEALTHIER FORCE</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <RoleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}