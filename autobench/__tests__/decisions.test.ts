import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import {
  logTriedChange,
  loadTriedChanges,
  formatTriedChangesForPrompt,
  setResultsDir,
  resetResultsDir,
} from '../artifacts/decisions.js';
import type { TriedChange } from '../types.js';

function makeChange(overrides: Partial<TriedChange> = {}): TriedChange {
  return {
    iteration: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    hypothesis: 'Add *.random.* → CWE-330',
    file: 'skills/sast-scan/SKILL.md',
    find: '## Next Steps',
    replace: '| `*.random.*` | CWE-330 | Rule 2 |\n\n## Next Steps',
    outcome: 'reject',
    f1Delta: -0.02,
    generator: 'rules',
    ...overrides,
  };
}

let tempDir: string;

describe('decisions logger', () => {
  beforeEach(() => {
    tempDir = resolve(tmpdir(), `autobench-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    setResultsDir(tempDir);
  });

  afterEach(() => {
    resetResultsDir();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('round-trip: logTriedChange → loadTriedChanges', () => {
    const change = makeChange({ iteration: 1, hypothesis: 'test round trip' });
    logTriedChange(change);
    const loaded = loadTriedChanges();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].iteration).toBe(1);
    expect(loaded[0].hypothesis).toBe('test round trip');
    expect(loaded[0].outcome).toBe('reject');
    expect(loaded[0].f1Delta).toBe(-0.02);
  });

  it('loadTriedChanges returns empty array when file does not exist', () => {
    const result = loadTriedChanges();
    expect(result).toEqual([]);
  });

  it('appends multiple entries and reads all of them', () => {
    logTriedChange(makeChange({ iteration: 1 }));
    logTriedChange(makeChange({ iteration: 2 }));
    logTriedChange(makeChange({ iteration: 3 }));
    const loaded = loadTriedChanges();
    expect(loaded).toHaveLength(3);
    expect(loaded.map(c => c.iteration)).toEqual([1, 2, 3]);
  });

  it('formatTriedChangesForPrompt respects limit', () => {
    for (let i = 0; i < 10; i++) {
      logTriedChange(makeChange({ iteration: i }));
    }
    const formatted = formatTriedChangesForPrompt(3);
    const lines = formatted.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3);
  });

  it('formatTriedChangesForPrompt shows last N entries (not first N)', () => {
    for (let i = 1; i <= 5; i++) {
      logTriedChange(makeChange({ iteration: i }));
    }
    const formatted = formatTriedChangesForPrompt(2);
    expect(formatted).toContain('iter 4');
    expect(formatted).toContain('iter 5');
    expect(formatted).not.toContain('iter 1');
  });

  it('formatTriedChangesForPrompt includes REJECT/PROMOTE labels', () => {
    logTriedChange(makeChange({ outcome: 'promote', f1Delta: 0.05 }));
    logTriedChange(makeChange({ outcome: 'reject', f1Delta: -0.01 }));
    const formatted = formatTriedChangesForPrompt(20);
    expect(formatted).toContain('[PROMOTE]');
    expect(formatted).toContain('[REJECT]');
  });

  it('formatTriedChangesForPrompt includes FAILED label', () => {
    logTriedChange(makeChange({ outcome: 'failed_to_apply', f1Delta: 0 }));
    const formatted = formatTriedChangesForPrompt(20);
    expect(formatted).toContain('[FAILED]');
  });

  it('formatTriedChangesForPrompt includes delta F1 with sign', () => {
    logTriedChange(makeChange({ f1Delta: 0.123, outcome: 'promote' }));
    logTriedChange(makeChange({ iteration: 2, f1Delta: -0.05, outcome: 'reject' }));
    const formatted = formatTriedChangesForPrompt(20);
    expect(formatted).toContain('+0.123');
    expect(formatted).toContain('-0.050');
  });

  it('formatTriedChangesForPrompt truncates long hypotheses', () => {
    const long = 'A'.repeat(100);
    logTriedChange(makeChange({ hypothesis: long }));
    const formatted = formatTriedChangesForPrompt(20);
    expect(formatted).toContain('...');
    // Full 100-char hypothesis should NOT appear
    expect(formatted).not.toContain(long);
  });

  it('formatTriedChangesForPrompt returns empty string when no changes', () => {
    const formatted = formatTriedChangesForPrompt(20);
    expect(formatted).toBe('');
  });
});
