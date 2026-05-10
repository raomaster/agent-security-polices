import { describe, it, expect } from 'vitest';
import { normalizeCwe } from '../normalization/cwe.js';
import { normalizeSeverity } from '../normalization/severity.js';

// ─── normalizeCwe ────────────────────────────────────────────────────

describe('normalizeCwe', () => {
  it('pads 2-digit CWE to 3 digits', () => {
    expect(normalizeCwe('CWE-79')).toBe('CWE-079');
  });

  it('pads 1-digit CWE to 3 digits', () => {
    expect(normalizeCwe('CWE-9')).toBe('CWE-009');
  });

  it('keeps already-padded CWE unchanged', () => {
    expect(normalizeCwe('CWE-079')).toBe('CWE-079');
  });

  it('handles 4-digit CWE without truncation', () => {
    expect(normalizeCwe('CWE-1234')).toBe('CWE-1234');
  });

  it('handles CWE without dash (CWE079)', () => {
    expect(normalizeCwe('CWE079')).toBe('CWE-079');
  });

  it('returns UNKNOWN for bare numeric string (no CWE prefix)', () => {
    // The regex requires CWE prefix — bare numbers are not recognized
    expect(normalizeCwe('79')).toBe('UNKNOWN');
  });

  it('handles CWE with description suffix', () => {
    expect(normalizeCwe('CWE-79: XSS')).toBe('CWE-079');
  });

  it('handles array input — uses first element', () => {
    expect(normalizeCwe(['CWE-79'])).toBe('CWE-079');
  });

  it('returns UNKNOWN for empty string', () => {
    expect(normalizeCwe('')).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for null', () => {
    expect(normalizeCwe(null)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for undefined', () => {
    expect(normalizeCwe(undefined)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for non-CWE string', () => {
    expect(normalizeCwe('XSS')).toBe('UNKNOWN');
  });

  it('is case-insensitive', () => {
    expect(normalizeCwe('cwe-79')).toBe('CWE-079');
    expect(normalizeCwe('Cwe-079')).toBe('CWE-079');
  });

  it('handles empty array', () => {
    // Array.isArray([]) → true, raw[0] = undefined → String(undefined) = "undefined" → UNKNOWN
    expect(normalizeCwe([])).toBe('UNKNOWN');
  });
});

// ─── normalizeSeverity ───────────────────────────────────────────────

describe('normalizeSeverity', () => {
  it('maps semgrep ERROR to HIGH', () => {
    expect(normalizeSeverity('ERROR', 'semgrep')).toBe('HIGH');
  });

  it('maps semgrep WARNING to MEDIUM', () => {
    expect(normalizeSeverity('WARNING', 'semgrep')).toBe('MEDIUM');
  });

  it('maps semgrep INFO to LOW', () => {
    expect(normalizeSeverity('INFO', 'semgrep')).toBe('LOW');
  });

  it('defaults semgrep unknown severity to MEDIUM', () => {
    expect(normalizeSeverity('WHATEVER', 'semgrep')).toBe('MEDIUM');
  });

  it('defaults undefined semgrep severity to MEDIUM', () => {
    expect(normalizeSeverity(undefined, 'semgrep')).toBe('MEDIUM');
  });

  it('defaults undefined gitleaks severity to HIGH', () => {
    expect(normalizeSeverity(undefined, 'gitleaks')).toBe('HIGH');
  });

  it('passes through valid CRITICAL severity for non-semgrep tools', () => {
    expect(normalizeSeverity('CRITICAL', 'gitleaks')).toBe('CRITICAL');
  });

  it('passes through valid HIGH severity for non-semgrep tools', () => {
    expect(normalizeSeverity('HIGH', 'gitleaks')).toBe('HIGH');
  });

  it('passes through valid LOW severity for non-semgrep tools', () => {
    expect(normalizeSeverity('LOW', 'gitleaks')).toBe('LOW');
  });

  it('defaults unknown severity to MEDIUM for non-semgrep tools', () => {
    expect(normalizeSeverity('BOGUS', 'gitleaks')).toBe('MEDIUM');
  });

  it('is case-insensitive for non-semgrep tools', () => {
    expect(normalizeSeverity('critical', 'gitleaks')).toBe('CRITICAL');
    expect(normalizeSeverity('high', 'gitleaks')).toBe('HIGH');
  });
});
