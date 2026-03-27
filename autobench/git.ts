import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// ─── Git Operations ─────────────────────────────────────────────────

function git(args: string[], cwd = ROOT): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 10_000
  }).trim();
}

export function getCommitHash(): string {
  return git(['rev-parse', 'HEAD']);
}

export function getShortHash(): string {
  return git(['rev-parse', '--short', 'HEAD']);
}

export function getStatus(): string {
  return git(['status', '--short']);
}

export function stageFile(filePath: string): void {
  git(['add', filePath]);
}

export function commit(message: string): string {
  git(['commit', '-m', message]);
  return getShortHash();
}

export function revertTo(hash: string): void {
  git(['reset', '--hard', hash]);
}

export function stash(): void {
  git(['stash', '--include-untracked']);
}

export function stashPop(): void {
  try { git(['stash', 'pop']); } catch { /* ignore if no stash */ }
}

// ─── High-level: commit a change with context ───────────────────────

export function commitChange(
  filePath: string,
  message: string,
  iteration: number
): string {
  stageFile(filePath);
  const fullMessage = `[autobench] iter ${iteration}: ${message}`;
  return commit(fullMessage);
}

// ─── Check if working tree is clean ─────────────────────────────────

export function isClean(): boolean {
  try {
    const status = getStatus();
    return status.length === 0;
  } catch {
    return true;
  }
}
