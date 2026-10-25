import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ROLES, type AccessLevel, type Permission, type RoleDef } from './dictionary';
import { logAccess } from './auditLog';
import type { UserProfile } from './profile';
import { supabase, requireSupabase, supabaseConfigurationError, databaseError } from './supabase';

interface AuthValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  userId: string;
  email: string;
  role: RoleDef;
  profile: UserProfile;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  can: (permission: Permission) => boolean;
  canWrite: (permission: Permission) => boolean;
  canUpload: () => boolean;
  canDeleteImports: () => boolean;
  canAccessIngestion: () => boolean;
  canAdministerSurveillance: () => boolean;
  level: (permission: Permission) => AccessLevel;
}

const AuthContext = createContext<AuthValue | null>(null);
const DENIED: RoleDef = { id: 'unassigned', label: 'No assigned role', grants: { demographics: 'no-access', clinicalLab: 'no-access', physicalExam: 'no-access', surveillance: 'no-access', audit: 'no-access' } };
const EMPTY_PROFILE: UserProfile = { fullName: '', assignedUnit: '' };
const READ: AccessLevel[] = ['view', 'view-status', 'edit-view', 'create-edit-view', 'full-access', 'file-upload', 'ingestion-errors'];
const WRITE: AccessLevel[] = ['edit-view', 'create-edit-view', 'full-access'];
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface AuthenticatedUser {
  id: string;
  email: string;
  profile: UserProfile;
  role: RoleDef;
}

async function loadUser(session: Session): Promise<AuthenticatedUser> {
  const client = requireSupabase();
  const { data: profile, error } = await client.from('profiles').select('id,full_name,email,assigned_unit,role_id').eq('id', session.user.id).single();
  if (error) {
    if (error.code === 'PGRST116') throw new Error('Your account has no assigned profile. Ask your administrator to assign your role and unit in Supabase.');
    throw databaseError(error.message, error.code);
  }
  const { data: role, error: roleError } = await client.from('roles').select('id,label,grants').eq('id', profile.role_id).single();
  if (roleError) throw databaseError(roleError.message, roleError.code);
  if (!ROLES.some(known => known.id === role.id)) throw new Error('Your account has an unsupported role. Contact your administrator.');
  const allowedLevels = ['no-access', ...READ];
  if (!role.grants || !['demographics', 'clinicalLab', 'physicalExam', 'surveillance', 'audit'].every(key => allowedLevels.includes(role.grants[key]))) {
    throw new Error('Your role has invalid permissions. Contact your administrator.');
  }
  return { id: session.user.id, email: session.user.email ?? profile.email, profile: { fullName: profile.full_name, assignedUnit: profile.assigned_unit }, role: role as RoleDef };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setLoading] = useState(!!supabase);
  const [authError, setAuthError] = useState<string | null>(supabaseConfigurationError);
  const revision = useRef(0);

  const synchronize = useCallback(async (session: Session | null) => {
    const current = ++revision.current;
    try {
      const next = session ? await loadUser(session) : null;
      if (current === revision.current) { setUser(next); setAuthError(null); }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load your account.';
      if (current === revision.current) { setUser(null); setAuthError(message); }
      return message;
    } finally { if (current === revision.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fetch the protected profile after the auth callback returns.
      const timer = setTimeout(() => { timers.delete(timer); if (active) void synchronize(session); }, 0);
      timers.add(timer);
    });
    return () => { active = false; timers.forEach(clearTimeout); listener.subscription.unsubscribe(); };
  }, [synchronize]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return error.message;
      const failure = await synchronize(data.session);
      if (!failure) {
        try { await logAccess('Login'); }
        catch (auditError) { setAuthError(`Signed in, but the access event could not be saved: ${auditError instanceof Error ? auditError.message : 'Please check the connection.'}`); }
      }
      return failure;
    } catch (error) { return error instanceof Error ? error.message : 'Could not sign in. Check your connection.'; }
  }, [synchronize]);

  const performSignOut = useCallback(async (action: 'Logout' | 'Session Expired') => {
    let auditFailure: string | null = null;
    try {
      if (user) {
        try { await logAccess(action); }
        catch (error) { auditFailure = error instanceof Error ? error.message : 'Could not save the access event.'; }
      }
      const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
      if (error) throw error;
      await synchronize(null);
      if (auditFailure) setAuthError(`Signed out, but the access event could not be saved: ${auditFailure}`);
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Could not sign out. Check your connection and try again.'); }
  }, [user, synchronize]);
  const logout = useCallback(() => performSignOut('Logout'), [performSignOut]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { void performSignOut('Session Expired'); }, IDLE_TIMEOUT_MS); };
    const events = ['pointerdown', 'keydown', 'scroll', 'mousemove'] as const;
    events.forEach(event => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(event => window.removeEventListener(event, reset)); };
  }, [user, performSignOut]);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    if (!profile.fullName.trim()) throw new Error('Enter your full name.');
    if (profile.assignedUnit !== user?.profile.assignedUnit) throw new Error('Your assigned unit is managed by an administrator.');
    const { error } = await requireSupabase().rpc('update_my_profile', { p_full_name: profile.fullName.trim() });
    if (error) throw databaseError(error.message, error.code);
    setUser(previous => previous ? { ...previous, profile: { ...previous.profile, fullName: profile.fullName.trim() } } : null);
  }, [user?.profile.assignedUnit]);

  const value = useMemo<AuthValue>(() => {
    const role = user?.role ?? DENIED;
    const level = (permission: Permission) => role.grants[permission];
    return {
      isAuthenticated: !!user, isLoading, authError, userId: user?.id ?? '', email: user?.email ?? '', role,
      profile: user?.profile ?? EMPTY_PROFILE, login, logout, updateProfile, level,
      can: permission => READ.includes(level(permission)), canWrite: permission => WRITE.includes(level(permission)),
      canUpload: () => ['file-upload', 'full-access'].includes(level('audit')),
      canDeleteImports: () => level('audit') === 'full-access',
      canAccessIngestion: () => level('audit') !== 'no-access' || WRITE.includes(level('demographics')),
      canAdministerSurveillance: () => level('surveillance') === 'full-access',
    };
  }, [user, isLoading, authError, login, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
