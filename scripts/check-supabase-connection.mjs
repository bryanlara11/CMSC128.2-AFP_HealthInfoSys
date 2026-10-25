// Read-only project reachability check. Never prints credentials or patient data.
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.');
const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/roles?select=id&limit=0`, {
  headers: { apikey: key }, signal: AbortSignal.timeout(15000),
});
const body = await response.json();
if (response.status === 404) {
  console.log('Supabase project is reachable. The roles table is not available yet; run migration 202610250002_direct_supabase.sql.');
} else if ([401, 403].includes(response.status) && body.code === '42501') {
  console.log('Supabase project is reachable. Anonymous access to role definitions is correctly blocked.');
} else if (response.ok) {
  console.log('Supabase project is reachable. Role definitions are publicly readable; check that migration 202610250002_direct_supabase.sql has been applied.');
} else {
  console.log(`Supabase responded with HTTP ${response.status} (code ${body.code ?? 'unknown'}). Check the project URL, publishable key and migration state.`);
  process.exitCode = 1;
}
