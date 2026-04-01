import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExperimentRecord, TriedChange } from '../types.js';

let RESULTS_DIR = resolve(import.meta.dirname, '../..', 'results');
let DECISIONS_PATH = resolve(RESULTS_DIR, 'decisions.jsonl');
let TRIED_PATH = resolve(RESULTS_DIR, 'tried_changes.jsonl');

/** Override the results directory (for testing). Resets paths. */
export function setResultsDir(dir: string): void {
  RESULTS_DIR = dir;
  DECISIONS_PATH = resolve(dir, 'decisions.jsonl');
  TRIED_PATH = resolve(dir, 'tried_changes.jsonl');
}

/** Restore default results directory. */
export function resetResultsDir(): void {
  RESULTS_DIR = resolve(import.meta.dirname, '../..', 'results');
  DECISIONS_PATH = resolve(RESULTS_DIR, 'decisions.jsonl');
  TRIED_PATH = resolve(RESULTS_DIR, 'tried_changes.jsonl');
}

function ensureDir(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

export function logExperiment(record: ExperimentRecord): void {
  ensureDir();
  let json: string;
  try {
    json = JSON.stringify(record);
  } catch (err: any) {
    console.error(`Failed to serialize experiment record: ${err.message}`);
    return;
  }
  appendFileSync(DECISIONS_PATH, json + '\n', 'utf-8');
}

export function logTriedChange(change: TriedChange): void {
  ensureDir();
  let json: string;
  try {
    json = JSON.stringify(change);
  } catch (err: any) {
    console.error(`Failed to serialize tried change: ${err.message}`);
    return;
  }
  appendFileSync(TRIED_PATH, json + '\n', 'utf-8');
}

export function loadTriedChanges(): TriedChange[] {
  if (!existsSync(TRIED_PATH)) return [];
  const content = readFileSync(TRIED_PATH, 'utf-8').trim();
  if (!content) return [];
  return content
    .split('\n')
    .filter(line => line.trim())
    .map((line, idx) => {
      try {
        return JSON.parse(line) as TriedChange;
      } catch {
        console.error(`Skipping corrupted line ${idx + 1} in tried_changes.jsonl`);
        return null;
      }
    })
    .filter((item): item is TriedChange => item !== null);
}

export function loadExperiments(): ExperimentRecord[] {
  if (!existsSync(DECISIONS_PATH)) return [];
  const content = readFileSync(DECISIONS_PATH, 'utf-8').trim();
  if (!content) return [];
  return content
    .split('\n')
    .filter(line => line.trim())
    .map((line, idx) => {
      try {
        return JSON.parse(line) as ExperimentRecord;
      } catch {
        console.error(`Skipping corrupted line ${idx + 1} in decisions.jsonl`);
        return null;
      }
    })
    .filter((item): item is ExperimentRecord => item !== null);
}

/**
 * Returns a compact text block for insertion into the LLM user prompt.
 * Shows at most the last `limit` entries (default 20).
 * Format: "[REJECT] iter 3 — Add *.random.* → CWE-330 — ΔF1: -0.020"
 */
export function formatTriedChangesForPrompt(limit = 20): string {
  const changes = loadTriedChanges();
  if (changes.length === 0) return '';

  const recent = changes.slice(-limit);
  return recent
    .map(c => {
      const label = c.outcome === 'promote' ? 'PROMOTE' : c.outcome === 'failed_to_apply' ? 'FAILED' : 'REJECT';
      const hypothesis = c.hypothesis.length > 80 ? c.hypothesis.slice(0, 77) + '...' : c.hypothesis;
      const delta = (c.f1Delta >= 0 ? '+' : '') + c.f1Delta.toFixed(3);
      return `[${label}] iter ${c.iteration} — ${hypothesis} — ΔF1: ${delta}`;
    })
    .join('\n');
}
