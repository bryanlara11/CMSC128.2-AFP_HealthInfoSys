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

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ROLES, type AccessLevel, type Permission, type RoleDef } from './dictionary';

interface AuthValue {
  role: RoleDef;
  setRoleId: (id: string) => void;
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
const READ_LEVELS: AccessLevel[] = ['view', 'view-status', 'edit-view', 'create-edit-view', 'full-access', 'file-upload', 'ingestion-errors'];

/**
 * Demo default. Table 4 grants I.T. Personnel Create/Edit/View across every data
 * column plus full audit and surveillance access, so it is the only role that
 * can both ingest a workbook and export a report — which is what a walkthrough
 * needs. The matrix itself is unchanged; switch roles to see the others apply.
 */
export const DEFAULT_ROLE_ID = 'it-personnel';

export function AuthProvider({
  children,
  initialRoleId = DEFAULT_ROLE_ID,
}: {
  children: ReactNode;
  /** Overridable so a test or a restored session can pick the starting role. */
  initialRoleId?: string;
}) {
  const [roleId, setRoleId] = useState(initialRoleId);
  const role = useMemo(
    () => ROLES.find((r) => r.id === roleId) ?? ROLES.find((r) => r.id === DEFAULT_ROLE_ID)!,
    [roleId],
  );

  const value = useMemo<AuthValue>(() => {
    const level = (p: Permission) => role.grants[p];
    return {
      role,
      setRoleId,
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
  }, [role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
