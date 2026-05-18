/** Strips non-digits, returns E.164 for US numbers (+1XXXXXXXXXX), or null if invalid. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Returns a display-safe masked form: +1 (555) ···-4567 */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ···-${digits.slice(7)}`;
  }
  return e164;
}
