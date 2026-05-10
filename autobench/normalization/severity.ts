import type { NormalizedFinding } from '../types.js';

type Severity = NormalizedFinding['severity'];

const SEMGREP_MAP: Record<string, Severity> = {
  ERROR:   'HIGH',
  WARNING: 'MEDIUM',
  INFO:    'LOW',
};

export function normalizeSeverity(
  raw: string | undefined,
  tool: NormalizedFinding['tool']
): Severity {
  if (!raw) return tool === 'gitleaks' ? 'HIGH' : 'MEDIUM';
  const upper = raw.toUpperCase();
  if (tool === 'semgrep') return SEMGREP_MAP[upper] ?? 'MEDIUM';
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(upper)) {
    return upper as Severity;
  }
  return 'MEDIUM';
}
