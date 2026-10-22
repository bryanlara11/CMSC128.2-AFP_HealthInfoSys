/**
 * Table 4 — Role-Based Access Control.
 *
 * Implements the 8-role x 5-permission matrix from [HI_CMSC] Overview.pdf as a
 * React context so modules and actions can be gated. The analyst role is the
 * default because the pilot is surveillance-led (Q&A #4).
 *
 * This is client-side gating for the prototype. Per Q&A #3 the real system must
 * enforce the same matrix server-side; nothing here is a security boundary.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ROLES, type AccessLevel, type Permission, type RoleDef } from './dictionary';

/* ------------------------------------------------------------------ */
/*  Credential map — email → { password, roleId }                      */
/* ------------------------------------------------------------------ */

interface Credential {
  password: string;
  roleId: string;
}

const CREDENTIALS: Record<string, Credential> = {
  'admin_clerk_test@email.com':       { password: 'test123', roleId: 'admin-clerk' },
  'medtech_test@email.com':           { password: 'test123', roleId: 'medtech' },
  'radtech_test@email.com':           { password: 'test123', roleId: 'radtech' },
  'physical_therapist_test@email.com': { password: 'test123', roleId: 'physical-therapist' },
  'nurse_test@email.com':             { password: 'test123', roleId: 'nurse' },
  'medical_officer_test@email.com':   { password: 'test123', roleId: 'medical-officer' },
  'hseu_analyst_test@email.com':      { password: 'test123', roleId: 'hseu-analyst' },
  'it_personnel_test@email.com':      { password: 'test123', roleId: 'it-personnel' },
};

/* ------------------------------------------------------------------ */
/*  Public auth types                                                   */
/* ------------------------------------------------------------------ */

interface AuthValue {
  /** Whether the user is currently logged in. */
  isAuthenticated: boolean;
  /** The email of the logged-in user (empty when logged out). */
  email: string;
  role: RoleDef;

  /** Attempt login. Returns null on success or an error string on failure. */
  login: (email: string, password: string) => string | null;
  /** Sign out and return to the login screen. */
  logout: () => void;
  /** Read access to a permission area. */
  can: (p: Permission) => boolean;
  /** Write access (create/edit). */
  canWrite: (p: Permission) => boolean;
  /** Upload/ingestion rights, used by the Data Management module. */
  canUpload: () => boolean;
  /** Any read access to ingested data — grants visibility of the Data Management module. */
  canAccessIngestion: () => boolean;
  /** Configure / export / filter rights on the surveillance dashboard. */
  canAdministerSurveillance: () => boolean;
  level: (p: Permission) => AccessLevel;
}

const AuthContext = createContext<AuthValue | null>(null);

const WRITE_LEVELS: AccessLevel[] = ['edit-view', 'create-edit-view', 'full-access'];
const READ_LEVELS: AccessLevel[] = [
  'view',
  'view-status',
  'edit-view',
  'create-edit-view',
  'full-access',
  'file-upload',
  'ingestion-errors',
];

/**
 * Demo default. Table 4 grants I.T. Personnel Create/Edit/View across every data
 * column plus full audit and surveillance access, so it is the only role that
 * can both ingest a workbook and export a report — which is what a walkthrough
 * needs. The matrix itself is unchanged; switch roles to see the others apply.
 */
export const DEFAULT_ROLE_ID = 'it-personnel';

/** Idle timeout duration in milliseconds (5 minutes). */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export function AuthProvider({
  children,
  initialRoleId = DEFAULT_ROLE_ID,
}: {
  children: ReactNode;
  /** Overridable so a test or a restored session can pick the starting role. */
  initialRoleId?: string;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(initialRoleId);

  /* ---------- idle-timeout refs ---------- */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsAuthenticated(false);
      setEmail('');
      setRoleId(DEFAULT_ROLE_ID);
    }, IDLE_TIMEOUT_MS);
  }, [isAuthenticated]);

  /* Listen for user activity to reset the idle timer. */
  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const EVENTS: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ];

    resetTimer(); // start the countdown on login

    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  /* ---------- derived role ---------- */
  const role = useMemo(
    () => ROLES.find((r) => r.id === roleId) ?? ROLES.find((r) => r.id === DEFAULT_ROLE_ID)!,
    [roleId],
  );

  /* ---------- login / logout ---------- */
  const login = useCallback((inputEmail: string, inputPassword: string): string | null => {
    const normalised = inputEmail.trim().toLowerCase();
    const cred = CREDENTIALS[normalised];
    if (!cred) return 'Invalid email or password.';
    if (cred.password !== inputPassword) return 'Invalid email or password.';
    setEmail(normalised);
    setRoleId(cred.roleId);
    setIsAuthenticated(true);
    return null;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setEmail('');
    setRoleId(DEFAULT_ROLE_ID);
  }, []);

  /* ---------- context value ---------- */
  const value = useMemo<AuthValue>(() => {
    const level = (p: Permission) => role.grants[p];
    return {
      isAuthenticated,
      email,
      role,

      login,
      logout,
      level,
      can: (p) => READ_LEVELS.includes(level(p)),
      canWrite: (p) => WRITE_LEVELS.includes(level(p)),
      canUpload: () => level('audit') === 'file-upload' || level('audit') === 'full-access',
      /* Module visibility is broad: per Q&A #4a administrative staff "do data
         organization", and the analyst needs ingestion status & errors. The
         meaningful gate is the upload action, not the module. */
      canAccessIngestion: () => level('demographics') !== 'no-access',
      canAdministerSurveillance: () => level('surveillance') === 'full-access',
    };
  }, [role, isAuthenticated, email, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
