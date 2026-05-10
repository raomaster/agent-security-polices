import type { BenchmarkCase, ScanFinding, Metrics, AggregateMetrics } from './types.js';

const LINE_TOLERANCE = 2;

function matchFinding(finding: ScanFinding, cwe: string, line: number): boolean {
  return finding.cwe === cwe && Math.abs(finding.line - line) <= LINE_TOLERANCE;
}

// ─── Single Case Evaluation ─────────────────────────────────────────

export function evaluate(
  benchCase: BenchmarkCase,
  findings: ScanFinding[],
  tool: string,
  durationMs: number
): Metrics {
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;

  if (benchCase.vulnerable) {
    // Case has known vulnerabilities — check detection
    const matchedFindings = new Set<number>();

    for (const expected of benchCase.findings) {
      const found = findings.some((f, i) => {
        if (matchedFindings.has(i)) return false;
        if (matchFinding(f, expected.cwe, expected.line)) {
          matchedFindings.add(i);
          return true;
        }
        return false;
      });

      if (found) {
        tp++;
      } else {
        fn++;
      }
    }

    // Unmatched findings = false positives
    fp = findings.length - matchedFindings.size;
  } else {
    // Safe case — any finding is a false positive
    fp = findings.length;
    tn = findings.length === 0 ? 1 : 0;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : (tp > 0 ? 1 : 0);
  const recall = tp + fn > 0 ? tp / (tp + fn) : (tp > 0 ? 1 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    cwe: benchCase.cwe,
    tool,
    caseId: benchCase.id,
    language: benchCase.language,
    tp,
    fp,
    fn,
    tn,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    durationMs
  };
}

// ─── Aggregate Metrics ──────────────────────────────────────────────

export function aggregate(metrics: Metrics[]): AggregateMetrics {
  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  let totalTn = 0;

  const byCwe = new Map<string, { tp: number; fp: number; fn: number; count: number }>();
  const byTool = new Map<string, { tp: number; fp: number; fn: number; count: number }>();

  for (const m of metrics) {
    totalTp += m.tp;
    totalFp += m.fp;
    totalFn += m.fn;
    totalTn += m.tn;

    // Aggregate by CWE
    if (!byCwe.has(m.cwe)) byCwe.set(m.cwe, { tp: 0, fp: 0, fn: 0, count: 0 });
    const cweStats = byCwe.get(m.cwe)!;
    cweStats.tp += m.tp;
    cweStats.fp += m.fp;
    cweStats.fn += m.fn;
    cweStats.count++;

    // Aggregate by Tool
    if (!byTool.has(m.tool)) byTool.set(m.tool, { tp: 0, fp: 0, fn: 0, count: 0 });
    const toolStats = byTool.get(m.tool)!;
    toolStats.tp += m.tp;
    toolStats.fp += m.fp;
    toolStats.fn += m.fn;
    toolStats.count++;
  }

  const precision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const recall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const byCweResult = new Map<string, { precision: number; recall: number; f1: number; count: number }>();
  for (const [cwe, stats] of byCwe) {
    const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
    const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
    const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;
    byCweResult.set(cwe, { precision: round(p), recall: round(r), f1: round(f), count: stats.count });
  }

  const byToolResult = new Map<string, { precision: number; recall: number; f1: number; count: number }>();
  for (const [tool, stats] of byTool) {
    const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
    const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
    const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;
    byToolResult.set(tool, { precision: round(p), recall: round(r), f1: round(f), count: stats.count });
  }

  return {
    totalCases: metrics.length,
    totalTp,
    totalFp,
    totalFn,
    totalTn,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    byCwe: byCweResult,
    byTool: byToolResult
  };
}

// ─── Comparison ─────────────────────────────────────────────────────

export function compareScores(
  before: AggregateMetrics,
  after: AggregateMetrics
): { f1Delta: number; precisionDelta: number; recallDelta: number; improved: boolean } {
  const f1Delta = after.f1 - before.f1;
  const precisionDelta = after.precision - before.precision;
  const recallDelta = after.recall - before.recall;

  return {
    f1Delta: round(f1Delta),
    precisionDelta: round(precisionDelta),
    recallDelta: round(recallDelta),
    improved: f1Delta > 0.001 // threshold to consider improvement meaningful
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function round(n: number, decimals = 3): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ─── Report Formatting ──────────────────────────────────────────────

export function formatMetricsTable(metrics: Metrics[]): string {
  const header = `┌──────────────────────┬──────────┬──────┬────┬────┬────┬───────────┬────────┬────────┐`;
  const cols   = `│ CWE                  │ Tool     │ Case │ TP │ FP │ FN │ Precision │ Recall │   F1   │`;
  const sep    = `├──────────────────────┼──────────┼──────┼────┼────┼────┼───────────┼────────┼────────┤`;

  const rows = metrics.map(m => {
    return `│ ${pad(m.cwe, 20)} │ ${pad(m.tool, 8)} │ ${pad(m.caseId, 4)} │ ${pad(String(m.tp), 2)} │ ${pad(String(m.fp), 2)} │ ${pad(String(m.fn), 2)} │ ${pad(String(m.precision), 9)} │ ${pad(String(m.recall), 6)} │ ${pad(String(m.f1), 6)} │`;
  });

  const footer = `└──────────────────────┴──────────┴──────┴────┴────┴────┴───────────┴────────┴────────┘`;

  return [header, cols, sep, ...rows, footer].join('\n');
}

export function formatAggregateReport(agg: AggregateMetrics): string {
  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║                    AutoBench v0.1.0                         ║`,
    `║        Security Skills Benchmarking Framework               ║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  for (const [cwe, stats] of agg.byCwe) {
    if (!cwe || !stats) continue;
    lines.push(`║  ${pad(cwe, 22)} │ ${pad(String(stats.count), 4)} cases │ P:${pad(String(stats.precision), 5)} R:${pad(String(stats.recall), 5)} ║`);
  }

  lines.push(`╠══════════════════════════════════════════════════════════════╣`);
  lines.push(`║  ${pad('AGGREGATE', 22)} │ ${pad(String(agg.totalCases), 4)} cases │ P:${pad(String(agg.precision), 5)} R:${pad(String(agg.recall), 5)} ║`);
  lines.push(`║  ${pad('F1 Score', 22)} │ ${pad(String(agg.f1), 40)} ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════╝`);

  return lines.join('\n');
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
}
