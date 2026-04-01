import type { Proposal } from '../types.js';
import type { ProposerContext } from './prompts.js';
import { loadTriedChanges } from '../artifacts/decisions.js';

/**
 * Rule-based proposal generator — fallback when no LLM API key is configured.
 *
 * Ports the logic from the deprecated improver.ts with the following improvements:
 * - Returns Proposal | null (same interface as LLM proposer)
 * - Uses persistent tried_changes.jsonl for anti-cycling (not in-memory Set)
 * - Produces find/replace diffs instead of anchor-based insertion
 */
export function generateProposalFromRules(context: ProposerContext): Proposal | null {
  const { unmapped, falseNegatives, falsePositives, skillContent, skillName } = context;
  const triedChanges = loadTriedChanges();

  const tried = new Set(triedChanges.map(c => `${c.find}|||${c.replace}`));

  // ── Strategy 1: Unmapped findings where CWE matches expected benchmark CWE ──
  const byCwe = new Map<string, { ruleId: string; caseId: string; matchesExpected: boolean }>();

  for (const u of unmapped) {
    if (!u.cweFromTool || u.cweFromTool === 'UNKNOWN') continue;
    const existing = byCwe.get(u.cweFromTool);
    const matchesExpected = u.cweFromTool === u.expectedCwe;
    if (!existing || (matchesExpected && !existing.matchesExpected)) {
      byCwe.set(u.cweFromTool, { ruleId: u.ruleId, caseId: u.caseId, matchesExpected });
    }
  }

  const sorted = [...byCwe.entries()].sort((a, b) => {
    if (a[1].matchesExpected && !b[1].matchesExpected) return -1;
    if (!a[1].matchesExpected && b[1].matchesExpected) return 1;
    return 0;
  });

  for (const [cwe, info] of sorted) {
    const pattern = extractPatternFromRuleId(info.ruleId);
    if (!pattern) continue;

    const anchor = findInsertionAnchor(skillContent);
    if (!anchor) continue;

    const newRow = `| \`${pattern}\` | ${cwe} | Rule 2: Injection Prevention |`;
    const find = anchor;
    const replace = newRow + '\n' + anchor;

    if (tried.has(`${find}|||${replace}`)) continue;

    return {
      type: 'add_mapping',
      hypothesis: `Add mapping for ruleId pattern ${pattern} → ${cwe} (detected but unmapped in case ${info.caseId})`,
      file: `skills/${skillName}/SKILL.md`,
      find,
      replace,
      targetCwes: [cwe],
      expectedEffect: 'increase_recall',
      confidence: 0.7,
      generator: 'rules',
    };
  }

  // ── Strategy 2: False Negatives → suggest Semgrep pattern from CWE lookup ──
  for (const fn of falseNegatives) {
    const num = fn.cwe.match(/(\d+)/);
    const cwe = num ? `CWE-${num[1].padStart(3, '0')}` : fn.cwe;
    const pattern = suggestSemgrepPattern(cwe);
    if (!pattern) continue;

    const anchor = findInsertionAnchor(skillContent);
    if (!anchor) continue;

    const newRow = `| \`${pattern}\` | ${cwe} | Rule 2: Injection Prevention |`;
    const find = anchor;
    const replace = newRow + '\n' + anchor;

    if (tried.has(`${find}|||${replace}`)) continue;

    return {
      type: 'add_mapping',
      hypothesis: `Add CWE mapping ${pattern} → ${cwe} to capture missed detections in case ${fn.caseId}`,
      file: `skills/${skillName}/SKILL.md`,
      find,
      replace,
      targetCwes: [cwe],
      expectedEffect: 'increase_recall',
      confidence: 0.5,
      generator: 'rules',
    };
  }

  // ── Strategy 3: False Positives → propose removing the overly broad mapping ──
  // Group FPs by CWE, find the CWE with the most FP cases
  const fpByCwe = new Map<string, number>();
  for (const fp of falsePositives) {
    if (!fp.cwe || fp.cwe === 'UNKNOWN') continue;
    const num = fp.cwe.match(/(\d+)/);
    const cwe = num ? `CWE-${num[1].padStart(3, '0')}` : fp.cwe;
    fpByCwe.set(cwe, (fpByCwe.get(cwe) ?? 0) + 1);
  }

  // Sort by FP count descending — address the biggest source of noise first
  const sortedFpCwes = [...fpByCwe.entries()].sort((a, b) => b[1] - a[1]);

  for (const [cwe] of sortedFpCwes) {
    // Find the table row in skillContent that maps to this CWE
    const rowRegex = new RegExp(
      `\\|\\s*\`([^\`]+)\`\\s*\\|\\s*${cwe.replace('-', '-?')}\\s*\\|[^\\n]+\\|`,
      'i'
    );
    const match = skillContent.match(rowRegex);
    if (!match) continue;

    const row = match[0];
    // Only target rows with broad wildcard patterns (e.g. `*.*.*` or `*.x.*`)
    const patternMatch = row.match(/`([^`]+)`/);
    if (!patternMatch) continue;

    const pattern = patternMatch[1];
    const wildcards = (pattern.match(/\*/g) || []).length;
    if (wildcards < 2) continue; // already fairly specific, skip

    // Propose removing this row (remove_mapping)
    // find = the row + its trailing newline so it disappears cleanly
    const rowWithNewline = row + '\n';
    const find = skillContent.includes(rowWithNewline) ? rowWithNewline : row;
    const replace = find === rowWithNewline ? '' : '';

    if (tried.has(`${find}|||${replace}`)) continue;
    if (find.trim().length < 15) continue; // won't pass validator min-length check

    return {
      type: 'remove_mapping',
      hypothesis: `Remove broad mapping \`${pattern}\` → ${cwe} that generates false positives (${fpByCwe.get(cwe)} FP case(s))`,
      file: `skills/${skillName}/SKILL.md`,
      find,
      replace,
      targetCwes: [cwe],
      expectedEffect: 'increase_precision',
      confidence: 0.4,
      generator: 'rules',
    };
  }

  // ── No more proposals ──
  return null;
}

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
    'CWE-532': '*.log.secret*',
  };
  return patterns[cwe] ?? null;
}

function extractPatternFromRuleId(ruleId: string): string | null {
  if (!ruleId) return null;
  const parts = ruleId.split('.');
  if (parts.length < 2) return null;
  return `*.${parts[parts.length - 1]}.*`;
}

/**
 * Find the last row of the mapping table to use as insertion anchor.
 * Returns the last table row so we can insert before it.
 */
function findInsertionAnchor(content: string): string | null {
  const lines = content.split('\n');
  let lastTableRow: string | null = null;

  // Walk through lines looking for the ## Next Steps anchor or table rows
  for (const line of lines) {
    if (line.startsWith('## Next Steps')) {
      return line;
    }
  }

  // Fallback: find last table row and insert before "## Interpret" or similar
  for (const line of lines) {
    if (line.startsWith('## ') && lastTableRow) {
      return line;
    }
    if (line.startsWith('|') && !line.includes('---')) {
      lastTableRow = line;
    }
  }

  // No suitable anchor found — cannot generate a safe insertion point
  return null;
}
