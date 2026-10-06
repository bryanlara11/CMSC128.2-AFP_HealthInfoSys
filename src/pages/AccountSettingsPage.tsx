import { useState } from 'react';
import {
  User, Shield, Bell, Lock, Database, History, Save, CheckCircle,
  AlertTriangle, Smartphone, KeyRound, FileClock,
} from 'lucide-react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
}

function Toggle({ checked, onChange, label, description, icon, tone = 'default' }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="flex items-start gap-3 flex-1">
        {icon && <span className={tone === 'danger' ? 'text-status-danger mt-0.5' : 'text-text-muted mt-0.5'}>{icon}</span>}
        <div>
          <p className={`text-sm font-medium ${tone === 'danger' ? 'text-status-danger' : 'text-text-primary'}`}>{label}</p>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? (tone === 'danger' ? 'bg-status-danger' : 'bg-accent-teal') : 'bg-storm-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const auditLog = [
  { time: '2026-09-24 14:32', user: 'Juan Dela Cruz', action: 'VIEWED', subject: 'Patient records (Dengue, Sep 2026)', ip: '10.24.7.118' },
  { time: '2026-09-24 11:07', user: 'Maria Santos', action: 'IMPORTED', subject: 'HSEU_Influenza_Aug_2026.xlsx', ip: '10.24.7.204' },
  { time: '2026-09-23 16:45', user: 'Ana Reyes', action: 'EXPORTED', subject: 'Weekly epidemiological report (anonymized)', ip: '10.24.9.031' },
  { time: '2026-09-23 09:20', user: 'Carlos Mendoza', action: 'LOGIN', subject: 'Successful authentication (2FA)', ip: '10.24.7.155' },
  { time: '2026-09-22 13:58', user: 'Lisa Garcia', action: 'REJECTED', subject: 'Export request — PII acknowledgement missing', ip: '10.24.8.072' },
];

const actionTone: Record<string, string> = {
  VIEWED: 'badge-info',
  IMPORTED: 'badge-success',
  EXPORTED: 'badge-warning',
  LOGIN: 'bg-storm-200 text-primary',
  REJECTED: 'badge-danger',
};

export function AccountSettingsPage() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [thresholdAlerts, setThresholdAlerts] = useState(true);
  const [outbreakAlerts, setOutbreakAlerts] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [autoLock, setAutoLock] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Account Settings</h1>
          <p className="text-text-secondary mt-1">Profile, notifications, security and audit trail</p>
        </div>
        <button onClick={handleSave} className="btn-primary whitespace-nowrap">
          {saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </div>

      {/* Profile */}
      <section className="card" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-base font-semibold text-primary p-5 pb-0 flex items-center gap-2">
          <User className="w-5 h-5" aria-hidden="true" />
          Profile
        </h2>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-text-primary mb-1.5">Full name</label>
            <input id="full-name" defaultValue="Juan Dela Cruz" className="input-base" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">Email address</label>
            <input id="email" type="email" defaultValue="juan.delacruz@afp.mil.ph" className="input-base" />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-text-primary mb-1.5">Role</label>
            <input id="role" defaultValue="HSEU Personnel — Clinical Encoder" className="input-base" readOnly />
          </div>
          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-text-primary mb-1.5">Assigned unit</label>
            <input id="unit" defaultValue="AFPMGC Health Surveillance & Epidemiology Unit" className="input-base" readOnly />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="card" aria-labelledby="notif-heading">
        <h2 id="notif-heading" className="text-base font-semibold text-primary p-5 pb-0 flex items-center gap-2">
          <Bell className="w-5 h-5" aria-hidden="true" />
          Notifications
        </h2>
        <div className="p-5 divide-y divide-storm-200">
          <Toggle
            checked={thresholdAlerts}
            onChange={setThresholdAlerts}
            label="Threshold breach alerts"
            description="Notify when a disease count exceeds the defined epidemic threshold for any region."
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <Toggle
            checked={outbreakAlerts}
            onChange={setOutbreakAlerts}
            label="Outbreak declarations"
            description="Notify when an outbreak is declared or escalated by a Regional Epidemiology Office."
            icon={<Database className="w-4 h-4" />}
          />
          <Toggle
            checked={emailAlerts}
            onChange={setEmailAlerts}
            label="Email notifications"
            description="Daily digest of surveillance activity sent to your AFP email address."
            icon={<Bell className="w-4 h-4" />}
          />
          <Toggle
            checked={smsAlerts}
            onChange={setSmsAlerts}
            label="SMS notifications"
            description="Critical alerts only, delivered to the mobile number on file."
            icon={<Smartphone className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* Security */}
      <section className="card" aria-labelledby="security-heading">
        <h2 id="security-heading" className="text-base font-semibold text-primary p-5 pb-0 flex items-center gap-2">
          <Lock className="w-5 h-5" aria-hidden="true" />
          Security
        </h2>
        <div className="p-5 divide-y divide-storm-200">
          <Toggle
            checked={twoFactor}
            onChange={setTwoFactor}
            label="Two-factor authentication"
            description="Require a one-time code from your authenticator app at every sign-in."
            icon={<KeyRound className="w-4 h-4" />}
          />
          <Toggle
            checked={autoLock}
            onChange={setAutoLock}
            label="Automatic session lock"
            description="Sign out after 15 minutes of inactivity on shared or field workstations."
            icon={<Lock className="w-4 h-4" />}
          />
          <div className="flex items-start justify-between gap-4 p-4">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-text-muted mt-0.5"><Shield className="w-4 h-4" /></span>
              <div>
                <p className="text-sm font-medium text-text-primary">Change password</p>
                <p className="text-xs text-text-muted mt-0.5">Last changed 42 days ago. Minimum 12 characters with mixed case and a numeral.</p>
              </div>
            </div>
            <button className="btn-secondary flex-shrink-0">Update</button>
          </div>
        </div>
      </section>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-forest-600/10 border border-forest-600/30">
        <Shield className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-text-primary">
          Patient records are classified under the Data Privacy Act. Access is restricted to authorized
          personnel, is recorded in the audit trail below, and individual identifiers are stripped
          automatically from any report submitted to the Department of Health.
        </p>
      </div>

      {/* Audit log */}
      <section className="card" aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="text-base font-semibold text-primary p-5 pb-3 flex items-center gap-2">
          <History className="w-5 h-5" aria-hidden="true" />
          Recent audit trail
        </h2>
        <div className="table-container border-0 rounded-none">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">User</th>
                <th scope="col">Action</th>
                <th scope="col">Subject</th>
                <th scope="col">IP address</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs whitespace-nowrap">{entry.time}</td>
                  <td className="text-sm">{entry.user}</td>
                  <td><span className={actionTone[entry.action]}>{entry.action}</span></td>
                  <td className="text-xs text-text-secondary">{entry.subject}</td>
                  <td className="font-mono text-xs">{entry.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-storm-200 flex items-center justify-between">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <FileClock className="w-3.5 h-3.5" aria-hidden="true" />
            Entries are retained for 5 years and cannot be modified.
          </p>
          <button className="btn-ghost">View full log</button>
        </div>
      </section>
    </div>
  );
}
