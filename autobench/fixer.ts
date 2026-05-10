import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ScanFinding } from './types.js';

// ─── Parsed from fix-findings SKILL.md ──────────────────────────────

export interface FixRuleMapping {
  findingType: string;
  cwe: string;
  rule: string;
}

export interface FixResult {
  finding: ScanFinding;
  rule: string;
  fixCode: string;
  explanation: string;
  severity: string;
  applied: boolean;
  verified: boolean;
}

// ─── Parse fix-findings SKILL.md ────────────────────────────────────

const FIX_RULES: FixRuleMapping[] = [
  { findingType: 'SQL Injection', cwe: 'CWE-89', rule: 'Rule 2: Injection Prevention' },
  { findingType: 'XSS', cwe: 'CWE-79', rule: 'Rule 2: Injection Prevention' },
  { findingType: 'OS Command Injection', cwe: 'CWE-78', rule: 'Rule 2 + Rule 8: Subprocess' },
  { findingType: 'Hardcoded Secrets', cwe: 'CWE-798', rule: 'Rule 3: Secrets Management' },
  { findingType: 'Missing Auth', cwe: 'CWE-862', rule: 'Rule 4: Auth & Authorization' },
  { findingType: 'Weak Crypto', cwe: 'CWE-327', rule: 'Rule 6: Cryptography' },
  { findingType: 'Path Traversal', cwe: 'CWE-22', rule: 'Rule 2: Injection Prevention' },
  { findingType: 'Deserialization', cwe: 'CWE-502', rule: 'Rule 2: Injection Prevention' },
  { findingType: 'SSRF', cwe: 'CWE-918', rule: 'Rule 2: Injection Prevention' },
  { findingType: 'Race Condition', cwe: 'CWE-362', rule: 'Rule 10: Concurrency' },
  { findingType: 'Weak Random', cwe: 'CWE-330', rule: 'Rule 6: Cryptography' },
  { findingType: 'Log Secrets', cwe: 'CWE-532', rule: 'Rule 3: Secrets Management' },
  { findingType: 'Info Disclosure', cwe: 'CWE-200', rule: 'Rule 9: Data Protection' },
  { findingType: 'Auth Bypass', cwe: 'CWE-287', rule: 'Rule 4: Auth & Authorization' }
];

// ─── Map finding to AGENT_RULES.md rule ─────────────────────────────

export function mapToRule(finding: ScanFinding): FixRuleMapping | null {
  const cweNorm = finding.cwe.padStart(7, '0');
  return FIX_RULES.find(r => r.cwe === cweNorm) || null;
}

// ─── Step 2: Triage (severity priority as per fix-findings) ─────────

export function triageBySeverity(findings: ScanFinding[]): ScanFinding[] {
  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  return [...findings].sort((a, b) => (order[a.severity] ?? 99) - (order[b.severity] ?? 99));
}

// ─── Step 4: Generate fix (following fix-findings output format) ────

const FIX_TEMPLATES: Record<string, { fix: string; explanation: string }> = {
  'CWE-079': {
    fix: 'Sanitize user input before rendering. Use DOMPurify.sanitize() or framework auto-escaping.',
    explanation: 'Unsanitized user input rendered in HTML allows XSS attacks. Always escape or sanitize before rendering.'
  },
  'CWE-089': {
    fix: 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = ?", [userId])',
    explanation: 'Parameterized queries separate SQL code from data, preventing injection.'
  },
  'CWE-078': {
    fix: 'Use execFile() with args array instead of exec() with string interpolation.',
    explanation: 'execFile() does not spawn a shell, preventing command injection.'
  },
  'CWE-798': {
    fix: 'Move to environment variable: process.env.API_KEY or os.environ["API_KEY"]',
    explanation: 'Hardcoded secrets in source code are exposed in version control. Use env vars or a secrets manager.'
  },
  'CWE-532': {
    fix: 'Redact sensitive fields before logging: logger.info("Login", { user, password: "[REDACTED]" })',
    explanation: 'Sensitive data in logs can be exposed through log aggregation systems.'
  },
  'CWE-327': {
    fix: 'Use strong algorithms: bcrypt for passwords, AES-256-GCM for encryption.',
    explanation: 'Weak algorithms (MD5, SHA1, DES) are cryptographically broken.'
  },
  'CWE-330': {
    fix: 'Use crypto.randomBytes() or crypto.randomInt() instead of Math.random().',
    explanation: 'Math.random() is not cryptographically secure and predictable.'
  },
  'CWE-022': {
    fix: 'Validate path with path.resolve() and check it stays within allowed directory.',
    explanation: 'User-controlled file paths can escape intended directory via ../ sequences.'
  },
  'CWE-502': {
    fix: 'Use json.loads() or yaml.safe_load() instead of pickle.loads() or yaml.load().',
    explanation: 'Unsafe deserialization can execute arbitrary code.'
  },
  'CWE-287': {
    fix: 'Verify JWT with explicit algorithm: jwt.verify(token, secret, { algorithms: ["HS256"] })',
    explanation: 'Allowing "none" algorithm bypasses JWT verification entirely.'
  },
  'CWE-862': {
    fix: 'Add authorization middleware: app.delete("/admin/:id", requireAuth, requireRole("admin"), handler)',
    explanation: 'Endpoints without authorization checks allow unauthorized access.'
  }
};

// ─── Generate fix report (following fix-findings format) ────────────

export function generateFix(finding: ScanFinding): FixResult {
  const ruleMapping = mapToRule(finding);
  const cweNorm = finding.cwe.padStart(7, '0');
  const template = FIX_TEMPLATES[cweNorm];

  return {
    finding,
    rule: ruleMapping?.rule || 'No mapping found',
    fixCode: template?.fix || 'Review AGENT_RULES.md for the applicable rule.',
    explanation: template?.explanation || '',
    severity: finding.severity,
    applied: false,
    verified: false
  };
}

// ─── Step 6: Validate fix (re-scan to verify) ───────────────────────

// This is called by runner.ts after applying a fix to a temp file
// It re-runs the tool and checks if the finding is gone
