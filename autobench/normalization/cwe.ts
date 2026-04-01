/**
 * Normalize any CWE representation to "CWE-NNN" with zero-padded 3-digit number.
 * Handles: "CWE-79" → "CWE-079", "CWE079" → "CWE-079", "CWE-79: XSS" → "CWE-079", ["CWE-79"] → "CWE-079"
 * Note: bare numeric strings (e.g., "79") are NOT recognized — a "CWE" prefix is required.
 * If input is falsy or does not contain a CWE pattern, returns 'UNKNOWN'.
 */
export function normalizeCwe(raw: unknown): string {
  if (!raw) return 'UNKNOWN';
  const s = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const match = s.match(/CWE-?(\d+)/i);
  if (!match) return 'UNKNOWN';
  return `CWE-${match[1].padStart(3, '0')}`;
}
