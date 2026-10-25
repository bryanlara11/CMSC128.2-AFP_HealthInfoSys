/**
 * Login page — landing screen for all users.
 *
 * Authenticates against Supabase and loads the protected role and unit profile.
 * On success the AuthProvider sets isAuthenticated = true, which causes
 * App.tsx to render the Shell instead of this page.
 */

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { Shield, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../data/auth';

export function LoginPage() {
  const { login, authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const result = await login(email, password);
        if (result) {
          setError(result);
          setShake(true);
          setTimeout(() => setShake(false), 500);
        }
      } finally { setLoading(false); }
    },
    [email, password, login],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      {/* Decorative top bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent-teal to-forest-600" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Branding */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg">
              <Shield className="w-9 h-9 text-cream-100" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary tracking-tight leading-tight">
                AFP Medical Corps
              </h1>
              <p className="text-sm font-medium text-accent-teal mt-1">
                Health Surveillance &amp; Epidemiology Unit
              </p>
              <p className="text-xs text-text-muted tracking-wider uppercase mt-1">
                Data for a Healthier Force
              </p>
            </div>
          </div>

          {/* Login card */}
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Sign in to your account</h2>
              <p className="text-sm text-text-muted mt-1">
                Enter your credentials to access the Health Information System.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-sm font-medium text-text-primary">
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="role_test@email.com"
                  className="input-base"
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-text-primary">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="input-base pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                      : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {(error || authError) && (
                <div
                  role="alert"
                  className={`flex items-center gap-2 text-sm text-status-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 ${
                    shake ? 'animate-shake' : ''
                  }`}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {error || authError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full gap-2 py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer inside the login screen */}
          <p className="text-center text-xs text-text-muted">
            &copy; 2026 Armed Forces of the Philippines Medical Corps &mdash; HSEU
          </p>
        </div>
      </div>
    </div>
  );
}
