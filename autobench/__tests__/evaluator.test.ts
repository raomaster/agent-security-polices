import { describe, it, expect } from 'vitest';
import { evaluate, aggregate, compareScores } from '../evaluator.js';
import type { BenchmarkCase, ScanFinding, Metrics } from '../types.js';

describe('evaluator', () => {
  describe('evaluate', () => {
    it('should count TP for detected vulnerability', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-001',
        file: 'vuln.js',
        language: 'javascript',
        cwe: 'CWE-079',
        vulnerable: true,
        findings: [
          { line: 10, cwe: 'CWE-079', severity: 'HIGH', description: 'XSS' }
        ]
      };

      const scanFindings: ScanFinding[] = [
        {
          tool: 'semgrep',
          file: 'vuln.js',
          line: 10,
          cwe: 'CWE-079',
          severity: 'HIGH',
          message: 'XSS detected',
          ruleId: 'test-rule'
        }
      ];

      const metrics = evaluate(benchCase, scanFindings, 'semgrep', 1000);

      expect(metrics.tp).toBe(1);
      expect(metrics.fp).toBe(0);
      expect(metrics.fn).toBe(0);
      expect(metrics.precision).toBe(1);
      expect(metrics.recall).toBe(1);
      expect(metrics.f1).toBe(1);
    });

    it('should count FN for missed vulnerability', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-002',
        file: 'vuln.js',
        language: 'javascript',
        cwe: 'CWE-089',
        vulnerable: true,
        findings: [
          { line: 5, cwe: 'CWE-089', severity: 'CRITICAL', description: 'SQLi' }
        ]
      };

      const metrics = evaluate(benchCase, [], 'semgrep', 500);

      expect(metrics.tp).toBe(0);
      expect(metrics.fn).toBe(1);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1).toBe(0);
    });

    it('should count FP for false positive on safe code', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-003',
        file: 'safe.js',
        language: 'javascript',
        cwe: 'CWE-079',
        vulnerable: false,
        findings: []
      };

      const scanFindings: ScanFinding[] = [
        {
          tool: 'semgrep',
          file: 'safe.js',
          line: 10,
          cwe: 'CWE-079',
          severity: 'HIGH',
          message: 'XSS detected',
          ruleId: 'test-rule'
        }
      ];

      const metrics = evaluate(benchCase, scanFindings, 'semgrep', 800);

      expect(metrics.tp).toBe(0);
      expect(metrics.fp).toBe(1);
      expect(metrics.tn).toBe(0);
    });

    it('should count TN for clean code not flagged', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-004',
        file: 'safe.js',
        language: 'javascript',
        cwe: 'CWE-079',
        vulnerable: false,
        findings: []
      };

      const metrics = evaluate(benchCase, [], 'semgrep', 600);

      expect(metrics.fp).toBe(0);
      expect(metrics.tn).toBe(1);
    });

    it('should handle line tolerance for matching', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-005',
        file: 'vuln.js',
        language: 'javascript',
        cwe: 'CWE-022',
        vulnerable: true,
        findings: [
          { line: 10, cwe: 'CWE-022', severity: 'HIGH', description: 'Path traversal' }
        ]
      };

      const scanFindings: ScanFinding[] = [
        {
          tool: 'semgrep',
          file: 'vuln.js',
          line: 12, // within tolerance of 2
          cwe: 'CWE-022',
          severity: 'HIGH',
          message: 'Path traversal',
          ruleId: 'test-rule'
        }
      ];

      const metrics = evaluate(benchCase, scanFindings, 'semgrep', 900);
      expect(metrics.tp).toBe(1);
    });

    it('should handle multiple findings per case', () => {
      const benchCase: BenchmarkCase = {
        id: 'test-006',
        file: 'vuln.py',
        language: 'python',
        cwe: 'CWE-798',
        vulnerable: true,
        findings: [
          { line: 4, cwe: 'CWE-798', severity: 'CRITICAL', description: 'API key' },
          { line: 9, cwe: 'CWE-798', severity: 'HIGH', description: 'JWT secret' }
        ]
      };

      const scanFindings: ScanFinding[] = [
        {
          tool: 'gitleaks',
          file: 'vuln.py',
          line: 4,
          cwe: 'CWE-798',
          severity: 'CRITICAL',
          message: 'Hardcoded key',
          ruleId: 'generic-api-key'
        }
      ];

      const metrics = evaluate(benchCase, scanFindings, 'gitleaks', 700);
      expect(metrics.tp).toBe(1);
      expect(metrics.fn).toBe(1);
    });
  });

  describe('aggregate', () => {
    it('should compute aggregate metrics correctly', () => {
      const metrics: Metrics[] = [
        { cwe: 'CWE-079', tool: 'semgrep', caseId: 'xss-001', language: 'js', tp: 1, fp: 0, fn: 0, tn: 0, precision: 1, recall: 1, f1: 1, durationMs: 100 },
        { cwe: 'CWE-079', tool: 'semgrep', caseId: 'xss-002', language: 'js', tp: 0, fp: 1, fn: 0, tn: 0, precision: 0, recall: 0, f1: 0, durationMs: 100 },
        { cwe: 'CWE-089', tool: 'semgrep', caseId: 'sqli-001', language: 'py', tp: 1, fp: 0, fn: 0, tn: 0, precision: 1, recall: 1, f1: 1, durationMs: 100 }
      ];

      const agg = aggregate(metrics);

      expect(agg.totalCases).toBe(3);
      expect(agg.totalTp).toBe(2);
      expect(agg.totalFp).toBe(1);
      expect(agg.totalFn).toBe(0);
      expect(agg.precision).toBeCloseTo(0.667, 2);
      expect(agg.recall).toBe(1);
    });

    it('should group by CWE', () => {
      const metrics: Metrics[] = [
        { cwe: 'CWE-079', tool: 'semgrep', caseId: 'xss-001', language: 'js', tp: 1, fp: 0, fn: 0, tn: 0, precision: 1, recall: 1, f1: 1, durationMs: 100 },
        { cwe: 'CWE-079', tool: 'semgrep', caseId: 'xss-002', language: 'js', tp: 0, fp: 1, fn: 0, tn: 0, precision: 0, recall: 0, f1: 0, durationMs: 100 },
        { cwe: 'CWE-089', tool: 'semgrep', caseId: 'sqli-001', language: 'py', tp: 1, fp: 0, fn: 0, tn: 0, precision: 1, recall: 1, f1: 1, durationMs: 100 }
      ];

      const agg = aggregate(metrics);

      expect(agg.byCwe.has('CWE-079')).toBe(true);
      expect(agg.byCwe.has('CWE-089')).toBe(true);
      expect(agg.byCwe.get('CWE-079')?.count).toBe(2);
      expect(agg.byCwe.get('CWE-089')?.count).toBe(1);
    });
  });

  describe('compareScores', () => {
    it('should detect improvement', () => {
      const before = { totalCases: 10, totalTp: 7, totalFp: 2, totalFn: 1, totalTn: 0, precision: 0.778, recall: 0.875, f1: 0.824, byCwe: new Map(), byTool: new Map() };
      const after = { totalCases: 10, totalTp: 8, totalFp: 1, totalFn: 1, totalTn: 0, precision: 0.889, recall: 0.889, f1: 0.889, byCwe: new Map(), byTool: new Map() };

      const result = compareScores(before, after);
      expect(result.improved).toBe(true);
      expect(result.f1Delta).toBeGreaterThan(0);
    });

    it('should detect no improvement', () => {
      const before = { totalCases: 10, totalTp: 8, totalFp: 1, totalFn: 1, totalTn: 0, precision: 0.889, recall: 0.889, f1: 0.889, byCwe: new Map(), byTool: new Map() };
      const after = { totalCases: 10, totalTp: 7, totalFp: 2, totalFn: 1, totalTn: 0, precision: 0.778, recall: 0.875, f1: 0.824, byCwe: new Map(), byTool: new Map() };

      const result = compareScores(before, after);
      expect(result.improved).toBe(false);
    });

    it('should require threshold for improvement', () => {
      const before = { totalCases: 10, totalTp: 8, totalFp: 1, totalFn: 1, totalTn: 0, precision: 0.889, recall: 0.889, f1: 0.889, byCwe: new Map(), byTool: new Map() };
      const after = { totalCases: 10, totalTp: 8, totalFp: 1, totalFn: 1, totalTn: 0, precision: 0.889, recall: 0.889, f1: 0.889, byCwe: new Map(), byTool: new Map() };

      const result = compareScores(before, after);
      expect(result.improved).toBe(false); // delta is 0, not improved
    });
  });
});
