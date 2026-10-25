import { useState, type FormEvent } from 'react';
import { Save, Shield, User } from 'lucide-react';
import { useAuth } from '../data/auth';
import { RecentActivity } from '../components/RecentActivity';

export function AccountSettingsPage() {
  const { profile, email, role, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile.fullName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try { await updateProfile({ fullName, assignedUnit: profile.assignedUnit }); setMessage('Profile saved to Supabase.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-6 max-w-4xl">
    <header><h1 className="text-2xl font-bold text-primary">Account Settings</h1><p className="text-text-secondary mt-1">Your authenticated profile and persistent activity history</p></header>
    <form onSubmit={event => { void save(event); }} className="card p-5 space-y-4">
      <h2 className="flex gap-2 items-center text-primary font-semibold"><User className="w-5 h-5" />Profile</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-sm text-text-secondary">Full name<input aria-label="Full name" required maxLength={200} className="input-base mt-1" value={fullName} onChange={event => setFullName(event.target.value)} /></label>
        <label className="text-sm text-text-secondary">Email address<input aria-label="Email address" type="email" className="input-base mt-1" value={email} readOnly /></label>
        <label className="text-sm text-text-secondary">Role<input aria-label="Role" className="input-base mt-1" value={role.label} readOnly /></label>
        <label className="text-sm text-text-secondary">Assigned unit<input aria-label="Assigned unit" className="input-base mt-1" value={profile.assignedUnit} readOnly /></label>
      </div>
      <p className="text-xs text-text-muted">Role and assigned unit are managed by an administrator. Name changes are recorded in the audit log.</p>
      <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save changes'}</button>
      {message && <p role="status" className="text-sm text-status-success">{message}</p>}{error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
    </form>
    <section className="card p-5 text-sm text-text-secondary"><h2 className="font-semibold text-primary flex gap-2 items-center mb-2"><Shield className="w-5 h-5" />Session security</h2><p>The application signs out after five minutes of inactivity. Supabase Auth manages authentication and token expiration.</p></section>
    <RecentActivity key={message ?? 'initial'} />
  </div>;
}
