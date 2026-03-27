import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Metrics } from './types.js';

// ─── Improvement types ──────────────────────────────────────────────

export interface Improvement {
  target: 'sast-scan' | 'fix-findings' | 'secrets-scan';
  file: string;
  description: string;
  change: string;       // Text to insert
  anchor: string;       // Where to insert (text before the insertion point)
}

// ─── Analyze metrics and propose improvements ───────────────────────

export function proposeImprovements(
  metrics: Metrics[],
  context?: {
    unmapped?: { ruleId: string; cwe: string; caseId: string }[];
    falsePositives?: { caseId: string; cwe: string }[];
    falseNegatives?: { caseId: string; cwe: string }[];
  }
): Improvement[] {
  const improvements: Improvement[] = [];

  // 0. Unmapped findings → add mapping to sast-scan SKILL.md
  //    This is the most common improvement: semgrep finds something
  //    but the skill doesn't have it in its mapping table
  if (context?.unmapped?.length) {
    const seen = new Set<string>();
    for (const u of context.unmapped) {
      const key = u.cwe;
      if (seen.has(key)) continue;
      seen.add(key);

      const pattern = extractPatternFromRuleId(u.ruleId);
      if (pattern) {
        improvements.push({
          target: 'sast-scan',
          file: 'skills/sast-scan/SKILL.md',
          description: `Add mapping: ${pattern} → ${u.cwe} (from ${u.caseId})`,
          change: `| \`${pattern}\` | ${u.cwe} | Rule 2: Injection Prevention |`,
          anchor: '## Next Steps'
        });
      }
    }
  }

  // Group failures by type
  const fns = metrics.filter(m => m.fn > 0);
  const fps = metrics.filter(m => m.fp > 0);

  // 1. False Negatives → add mapping or rule to sast-scan
  for (const m of fns) {
    if (!m.cwe) continue;
    const cwe = m.cwe.padStart(7, '0');
    const pattern = suggestSemgrepPattern(cwe);
    if (pattern) {
      improvements.push({
        target: 'sast-scan',
        file: 'skills/sast-scan/SKILL.md',
        description: `Add mapping for ${cwe} (${m.caseId} not detected)`,
        change: `| \`${pattern}\` | ${cwe} | Rule 2: Injection Prevention |`,
        anchor: '## Next Steps'
      });
    }
  }

  // 2. False Positives → add exclusion pattern to sast-scan
  for (const m of fps) {
    if (m.caseId.includes('safe')) {
      improvements.push({
        target: 'sast-scan',
        file: 'skills/sast-scan/SKILL.md',
        description: `Add exclusion for safe code patterns (${m.caseId})`,
        change: `- Skip findings in files matching \`*safe*\` pattern (verified safe code)`,
        anchor: '## References'
      });
    }
  }

  // 3. Unmapped CWEs in fix-findings
  const unmappedCwes = new Set<string>();
  for (const m of metrics) {
    if (!m.cwe) continue;
    if (m.fn > 0 && !hasFixFindingsMapping(m.cwe)) {
      unmappedCwes.add(m.cwe.padStart(7, '0'));
    }
  }
  for (const cwe of unmappedCwes) {
    improvements.push({
      target: 'fix-findings',
      file: 'skills/fix-findings/SKILL.md',
      description: `Add CWE→Rule mapping for ${cwe}`,
      change: `| ${getCweName(cwe)} | ${cwe} | Rule 2: Injection Prevention |`,
      anchor: '### 4. Generate Fixes'
    });
  }

  return improvements;
}

// ─── Apply an improvement to a SKILL.md file ────────────────────────

export function applyImprovement(improvement: Improvement): boolean {
  const filePath = resolve(import.meta.dirname, '..', '..', improvement.file);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const anchorIndex = content.indexOf(improvement.anchor);

    if (anchorIndex < 0) {
      console.warn(`    ⚠ Anchor "${improvement.anchor}" not found in ${improvement.file}`);
      return false;
    }

    // Insert change before the anchor
    const modified = content.slice(0, anchorIndex) +
      improvement.change + '\n\n' +
      content.slice(anchorIndex);

    writeFileSync(filePath, modified, 'utf-8');
    return true;
  } catch (err: any) {
    console.warn(`    ⚠ Failed to apply: ${err.message}`);
    return false;
  }
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

function hasFixFindingsMapping(cwe: string): boolean {
  const mapped = ['CWE-89', 'CWE-79', 'CWE-78', 'CWE-798', 'CWE-862',
                  'CWE-327', 'CWE-1035', 'CWE-22', 'CWE-200', 'CWE-502',
                  'CWE-918', 'CWE-362'];
  return mapped.includes(cwe.padStart(7, '0'));
}

function getCweName(cwe: string): string {
  const names: Record<string, string> = {
    'CWE-079': 'XSS',
    'CWE-089': 'SQL Injection',
    'CWE-078': 'OS Command Injection',
    'CWE-798': 'Hardcoded Secrets',
    'CWE-532': 'Log Secrets',
    'CWE-327': 'Weak Crypto',
    'CWE-330': 'Weak Random',
    'CWE-022': 'Path Traversal',
    'CWE-502': 'Deserialization',
    'CWE-287': 'Auth Bypass',
    'CWE-862': 'Missing Authz'
  };
  return names[cwe] || cwe;
}

function extractPatternFromRuleId(ruleId: string): string | null {
  if (!ruleId) return null;
  // Convert semgrep rule ID to a glob pattern for the skill mapping table
  // e.g., "javascript.express.security.injection.raw-html-format.raw-html-format"
  //    → "*.raw-html-format.*"
  const parts = ruleId.split('.');
  if (parts.length < 2) return null;
  // Use the last significant segment
  const lastPart = parts[parts.length - 1];
  return `*.${lastPart}.*`;
}
