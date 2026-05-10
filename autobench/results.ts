import { appendFileSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Metrics, RunResult, AggregateMetrics } from './types.js';

const RESULTS_DIR = resolve(import.meta.dirname, '..', 'results');
const TSV_PATH = resolve(RESULTS_DIR, 'results.tsv');

const TSV_HEADER = [
  'run_id', 'timestamp', 'cwe', 'tool', 'case_id', 'language',
  'tp', 'fp', 'fn', 'precision', 'recall', 'f1',
  'duration_ms', 'status', 'description'
].join('\t');

// ─── TSV Logging ────────────────────────────────────────────────────

export function initResultsTsv(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  if (!existsSync(TSV_PATH)) {
    writeFileSync(TSV_PATH, TSV_HEADER + '\n', 'utf-8');
  }
}

export function logMetrics(
  runId: number,
  metrics: Metrics,
  status: string = 'baseline',
  description: string = ''
): void {
  const timestamp = new Date().toISOString();
  const row = [
    runId,
    timestamp,
    metrics.cwe,
    metrics.tool,
    metrics.caseId,
    metrics.language,
    metrics.tp,
    metrics.fp,
    metrics.fn,
    metrics.precision,
    metrics.recall,
    metrics.f1,
    metrics.durationMs,
    status,
    description.replace(/\t/g, ' ')
  ].join('\t');

  appendFileSync(TSV_PATH, row + '\n', 'utf-8');
}

export function logAggregate(
  runId: number,
  agg: AggregateMetrics,
  status: string,
  description: string = ''
): void {
  const timestamp = new Date().toISOString();
  const row = [
    runId,
    timestamp,
    'ALL',
    'ALL',
    'ALL',
    'ALL',
    agg.totalTp,
    agg.totalFp,
    agg.totalFn,
    agg.precision,
    agg.recall,
    agg.f1,
    0,
    status,
    description.replace(/\t/g, ' ')
  ].join('\t');

  appendFileSync(TSV_PATH, row + '\n', 'utf-8');
}

// ─── Read History ───────────────────────────────────────────────────

export function readHistory(): RunResult[] {
  if (!existsSync(TSV_PATH)) return [];

  const content = readFileSync(TSV_PATH, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // skip header
  const runMap = new Map<number, Metrics[]>();

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 13) continue;

    const runId = parseInt(cols[0], 10);
    if (isNaN(runId)) continue;

    // Skip aggregate rows
    if (cols[2] === 'ALL') continue;

    const metric: Metrics = {
      cwe: cols[2],
      tool: cols[3],
      caseId: cols[4],
      language: cols[5],
      tp: parseInt(cols[6], 10),
      fp: parseInt(cols[7], 10),
      fn: parseInt(cols[8], 10),
      tn: 0,
      precision: parseFloat(cols[9]),
      recall: parseFloat(cols[10]),
      f1: parseFloat(cols[11]),
      durationMs: parseInt(cols[12], 10)
    };

    if (!runMap.has(runId)) runMap.set(runId, []);
    runMap.get(runId)!.push(metric);
  }

  const results: RunResult[] = [];
  for (const [runId, metrics] of runMap) {
    const agg = computeAggregateFromMetrics(metrics);
    results.push({
      runId,
      timestamp: metrics[0] ? new Date().toISOString() : '',
      aggregate: agg,
      metrics,
      durationMs: metrics.reduce((sum, m) => sum + m.durationMs, 0)
    });
  }

  return results.sort((a, b) => a.runId - b.runId);
}

function computeAggregateFromMetrics(metrics: Metrics[]): AggregateMetrics {
  let totalTp = 0, totalFp = 0, totalFn = 0, totalTn = 0;
  for (const m of metrics) {
    totalTp += m.tp;
    totalFp += m.fp;
    totalFn += m.fn;
    totalTn += m.tn;
  }

  const precision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const recall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    totalCases: metrics.length,
    totalTp,
    totalFp,
    totalFn,
    totalTn,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    byCwe: new Map(),
    byTool: new Map()
  };
}

function round(n: number, decimals = 3): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
