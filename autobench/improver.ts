import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Metrics } from './types.js';

// ─── Improvement types ──────────────────────────────────────────────

export interface Improvement {
  target: 'sast-scan' | 'fix-findings' | 'secrets-scan';
  file: string;
  description: string;
  change: string;
  anchor: string;
}

// Track tried improvements to avoid repeating
const triedChanges = new Set<string>();

// ─── Analyze and propose improvements ───────────────────────────────

export function proposeImprovements(
  metrics: Metrics[],
  context?: {
    unmapped?: { ruleId: string; cwe: string; caseId: string; expectedCwe?: string }[];
    falsePositives?: { caseId: string; cwe: string }[];
    falseNegatives?: { caseId: string; cwe: string }[];
  }
): Improvement[] {
  const improvements: Improvement[] = [];

  // 1. Unmapped findings where CWE matches expected benchmark CWE
  //    These have the highest potential impact on F1
  if (context?.unmapped?.length) {
    // Group by CWE, prefer findings that match the benchmark's expected CWE
    const byCwe = new Map<string, { ruleId: string; caseId: string; matchesExpected: boolean }>();

    for (const u of context.unmapped) {
      if (!u.cwe || u.cwe === 'UNKNOWN') continue;

      const existing = byCwe.get(u.cwe);
      const matchesExpected = u.expectedCwe ? u.cwe === u.expectedCwe.padStart(7, '0') : false;

      if (!existing || (matchesExpected && !existing.matchesExpected)) {
        byCwe.set(u.cwe, {
          ruleId: u.ruleId,
          caseId: u.caseId,
          matchesExpected
        });
      }
    }

    // Sort: matching CWEs first, then others
    const sorted = [...byCwe.entries()].sort((a, b) => {
      if (a[1].matchesExpected && !b[1].matchesExpected) return -1;
      if (!a[1].matchesExpected && b[1].matchesExpected) return 1;
      return 0;
    });

    for (const [cwe, info] of sorted) {
      const pattern = extractPatternFromRuleId(info.ruleId);
      if (!pattern) continue;

      const change = `| \`${pattern}\` | ${cwe} | Rule 2: Injection Prevention |`;
      if (triedChanges.has(change)) continue;

      improvements.push({
        target: 'sast-scan',
        file: 'skills/sast-scan/SKILL.md',
        description: `Add mapping: ${pattern} → ${cwe} (from ${info.caseId})`,
        change,
        anchor: '## Next Steps'
      });
    }
  }

  // 2. False Negatives → suggest semgrep pattern
  const fns = metrics.filter(m => m.fn > 0 && m.cwe);
  for (const m of fns) {
    const cwe = m.cwe.padStart(7, '0');
    const pattern = suggestSemgrepPattern(cwe);
    if (!pattern) continue;

    const change = `| \`${pattern}\` | ${cwe} | Rule 2: Injection Prevention |`;
    if (triedChanges.has(change)) continue;

    improvements.push({
      target: 'sast-scan',
      file: 'skills/sast-scan/SKILL.md',
      description: `Add mapping for ${cwe} (${m.caseId} not detected)`,
      change,
      anchor: '## Next Steps'
    });
  }

  // 3. False Positives on safe code → add exclusion
  const fps = metrics.filter(m => m.fp > 0);
  for (const m of fps) {
    if (!m.caseId.includes('safe')) continue;

    const change = `- Skip findings in files matching \`*safe*\` pattern (verified safe code)`;
    if (triedChanges.has(change)) continue;

    improvements.push({
      target: 'sast-scan',
      file: 'skills/sast-scan/SKILL.md',
      description: `Add exclusion for safe code (${m.caseId})`,
      change,
      anchor: '## References'
    });
  }

  return improvements;
}

// ─── Apply an improvement ───────────────────────────────────────────

export function applyImprovement(improvement: Improvement): boolean {
  const filePath = resolve(import.meta.dirname, '..', improvement.file);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const anchorIndex = content.indexOf(improvement.anchor);

    if (anchorIndex < 0) {
      console.warn(`    ⚠ Anchor "${improvement.anchor}" not found in ${improvement.file}`);
      return false;
    }

    // Mark as tried
    triedChanges.add(improvement.change);

    const modified = content.slice(0, anchorIndex) +
      improvement.change + '\n\n' +
      content.slice(anchorIndex);

    writeFileSync(filePath, modified, 'utf-8');
    return true;
  } catch (err: any) {
    console.warn(`    ⚠ Failed to apply: ${err.message}`);
    triedChanges.add(improvement.change);
    return false;
  }
}

// ─── Reset tried changes (for new loop run) ─────────────────────────

export function resetTriedChanges(): void {
  triedChanges.clear();
}

// ─── Helpers ────────────────────────────────────────────────────────

function suggestSemgrepPattern(cwe: string): string | null {
  const patterns: Record<string, string> = {
    'CWE-079': '*.xss.*',
    'CWE-089': '*.sql.injection.*',
    'CWE-078': '*.exec.*',
    'CWE-798': '*.hardcoded-*',
    'CWE-327': '*.crypto.weak-*',
    'CWE-330': '*.random.insecure*',
    'CWE-022': '*.path-traversal.*',
    'CWE-502': '*.deserialization.*',
    'CWE-287': '*.auth.bypass*',
    'CWE-862': '*.auth.missing*',
    'CWE-532': '*.log.secret*'
  };
  return patterns[cwe] || null;
}

function extractPatternFromRuleId(ruleId: string): string | null {
  if (!ruleId) return null;
  const parts = ruleId.split('.');
  if (parts.length < 2) return null;
  const lastPart = parts[parts.length - 1];
  return `*.${lastPart}.*`;
}
