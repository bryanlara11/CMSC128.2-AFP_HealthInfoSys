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
      <div className="px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={onMenuClick}
              className="md:hidden p-1.5 -ml-1.5 text-sky-200 hover:text-cream-100 rounded-lg hover:bg-white/5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="hidden sm:flex w-10 h-10 rounded-lg bg-forest-600 items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-cream-100" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-cream-100 tracking-tight leading-tight">
                ARMED FORCES OF THE PHILIPPINES MEDICAL CORPS
              </h1>
              <p className="text-sm font-medium text-sky-200 leading-snug">Health Surveillance and Epidemiology Unit</p>
              <p className="hidden md:block text-xs text-sky-200/80 tracking-wider uppercase mt-0.5">DATA FOR A HEALTHIER FORCE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto flex-shrink-0">
            <RoleSwitcher />
            
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={handleProfileClick}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-200 hover:text-cream-100 transition-colors rounded-lg hover:bg-white/5 border border-white/10"
                aria-expanded={showProfileMenu}
                aria-haspopup="true"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Juan Dela Cruz</span>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-background-card border border-storm-200 rounded-lg shadow-card-hover py-1 z-50">
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
      </div>
    </header>
  );
}