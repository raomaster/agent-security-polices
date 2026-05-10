import type { AggregateMetrics, Metrics, TriedChange } from '../types.js';

export interface UnmappedFinding {
  ruleId: string;
  cweFromTool: string;     // CWE Semgrep reported
  expectedCwe: string;     // CWE ground truth expects
  caseId: string;
}

export interface FailureCase {
  caseId: string;
  cwe: string;
  file: string;
  language: string;
}

export interface ProposerContext {
  iteration: number;
  skillName: string;
  skillContent: string;       // full content of the target SKILL.md
  aggregate: AggregateMetrics;
  metrics: Metrics[];
  unmapped: UnmappedFinding[];
  falsePositives: FailureCase[];
  falseNegatives: FailureCase[];
  triedChanges: TriedChange[];
}

export function buildSystemPrompt(): string {
  return `You are a security engineer improving a SAST skill configuration.

The pipeline works as follows:
  Semgrep runs on code → produces findings with ruleIds
  A SKILL.md mapping table converts ruleIds to CWEs via glob patterns
  Mapped findings are scored against labeled benchmark cases

Scoring:
  TP  — finding mapped to correct CWE, within ±2 lines of ground truth
  FP  — finding on safe code (vulnerable:false), or mapped to wrong CWE
  FN  — ground truth vulnerability not detected or not correctly mapped
  F1  — harmonic mean of precision and recall (higher is better)

Your role:
  Analyze the benchmark results and propose ONE targeted change to the
  SKILL.md mapping table that will improve F1 without increasing the FP
  rate on safe-code fixtures.

Output format — respond with a single JSON object, no other text:
  {
    "type": "add_mapping|remove_mapping|modify_mapping|add_exclusion|change_severity|add_fix_rule",
    "hypothesis": "one sentence explaining why this improves F1",
    "file": "path/relative/to/repo/root",
    "find": "exact verbatim string to find in the file",
    "replace": "exact replacement string",
    "targetCwes": ["CWE-NNN"],
    "expectedEffect": "increase_recall|increase_precision|both",
    "confidence": 0.0
  }

Rules:
  - ONE change per response
  - "find" must exist verbatim in the current file content shown below
  - Changes must be generalizable — never reference specific test filenames as patterns
  - Never use patterns broader than needed (avoid .*, prefer *.xss.*)
  - Never repeat a change from "Previously tried changes"
  - If no further useful change exists, respond with confidence: 0`;
}

export function buildUserPrompt(context: ProposerContext): string {
  const { iteration, skillName, aggregate, metrics, unmapped, falsePositives, falseNegatives, triedChanges, skillContent } = context;

  const sections: string[] = [];

  sections.push(`## Iteration ${iteration} — ${skillName}`);

  // Aggregate metrics
  const agg = aggregate;
  sections.push(`
### Aggregate Metrics
F1: ${agg.f1} | Precision: ${agg.precision} | Recall: ${agg.recall}
TP: ${agg.totalTp} | FP: ${agg.totalFp} | FN: ${agg.totalFn}`);

  // Per-CWE breakdown
  if (agg.byCwe.size > 0) {
    const rows = [...agg.byCwe.entries()]
      .map(([cwe, s]) => `${cwe.padEnd(10)} | ${String(s.count).padEnd(5)} | ${String(s.precision).padEnd(9)} | ${String(s.recall).padEnd(6)} | ${s.f1}`);
    sections.push(`
### Per-CWE Breakdown
${'CWE'.padEnd(10)} | Cases | Precision | Recall | F1
${'-'.repeat(55)}
${rows.join('\n')}`);
  }

  // Unmapped findings — top 10
  if (unmapped.length > 0) {
    const top10 = unmapped.slice(0, 10);
    const list = top10
      .map(u => `  ${u.ruleId} → tool CWE: ${u.cweFromTool} (expected: ${u.expectedCwe}) — case: ${u.caseId}`)
      .join('\n');
    sections.push(`
### Unmapped Findings — top 10 by expected CWE
These ruleIds were detected but are NOT in the mapping table:
${list}`);
  }

  // False negatives — top 5
  if (falseNegatives.length > 0) {
    const top5 = falseNegatives.slice(0, 5);
    const list = top5
      .map(fn => `  ${fn.caseId} (${fn.cwe})${fn.language ? ' [' + fn.language + ']' : ''}`)
      .join('\n');
    sections.push(`
### False Negatives — top 5
Ground truth vulnerabilities that were not detected:
${list}`);
  }

  // False positives — top 5
  if (falsePositives.length > 0) {
    const top5 = falsePositives.slice(0, 5);
    const list = top5
      .map(fp => `  ${fp.caseId} (${fp.cwe})`)
      .join('\n');
    sections.push(`
### False Positives on Safe Code — top 5
Safe fixtures incorrectly flagged:
${list}`);
  }

  // Current mapping table — extract only the table section
  const mappingTableSection = extractMappingTable(skillContent);
  const skillFile = `skills/${context.skillName}/SKILL.md`;
  sections.push(`
### Current Mapping Table (from ${skillFile})
${mappingTableSection}`);

  // Previously tried changes (from context, not disk)
  if (triedChanges.length > 0) {
    const recent = triedChanges.slice(-20);
    const tried = recent
      .map(c => {
        const label = c.outcome === 'promote' ? 'PROMOTE' : c.outcome === 'failed_to_apply' ? 'FAILED' : 'REJECT';
        const hypothesis = c.hypothesis.length > 80 ? c.hypothesis.slice(0, 77) + '...' : c.hypothesis;
        const delta = (c.f1Delta >= 0 ? '+' : '') + c.f1Delta.toFixed(3);
        return `[${label}] iter ${c.iteration} — ${hypothesis} — ΔF1: ${delta}`;
      })
      .join('\n');
    sections.push(`
### Previously Tried Changes (last 20)
${tried}`);
  }

  return sections.join('\n');
}

function extractMappingTable(content: string): string {
  // Find the "Common Findings & Rules" or similar section with the mapping table
  const lines = content.split('\n');
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('|') && line.includes('CWE')) {
      inTable = true;
    }
    if (inTable) {
      if (line.startsWith('|')) {
        tableLines.push(line);
      } else if (tableLines.length > 0 && !line.trim()) {
        // blank line ends the table
        break;
      }
    }
  }

  if (tableLines.length === 0) {
    // Fallback: return the full content (truncated)
    return content.length > 2000 ? content.slice(0, 2000) + '\n...[truncated]' : content;
  }

  return tableLines.join('\n');
}
