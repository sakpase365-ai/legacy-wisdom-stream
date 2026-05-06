const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
] as const;

let checked = false;

// Call at the top of each API route handler. Throws on first request if any
// required env var is missing or still set to a placeholder value.
export function assertEnv() {
  if (checked) return;

  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in .env.local (local) or Netlify environment variables (production).'
    );
  }

  // Detect unfilled template placeholders — placeholder values are truthy but unusable.
  // Without this check, assertEnv() silently passes while Supabase returns cryptic auth errors.
  const placeholders = REQUIRED.filter((k) => {
    const v = process.env[k]!;
    return v.startsWith('your_') || v.startsWith('YOUR_');
  });
  if (placeholders.length > 0) {
    throw new Error(
      `[env] Placeholder values detected for: ${placeholders.join(', ')}. ` +
      'Replace with real credentials before starting the server.'
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!supabaseUrl.startsWith('https://')) {
    throw new Error(
      `[env] NEXT_PUBLIC_SUPABASE_URL must be an HTTPS URL. Got: ${supabaseUrl.slice(0, 30)}`
    );
  }

  checked = true;
}
