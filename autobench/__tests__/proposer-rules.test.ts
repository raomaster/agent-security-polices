import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProposalFromRules } from '../agent/proposer-rules.js';
import type { ProposerContext } from '../agent/prompts.js';
import type { AggregateMetrics } from '../types.js';

vi.mock('../artifacts/decisions.js', () => ({
  loadTriedChanges: vi.fn().mockReturnValue([]),
}));

import { loadTriedChanges } from '../artifacts/decisions.js';

// SKILL.md content with a real ## Next Steps anchor
const MOCK_SKILL_CONTENT = `# SAST Scan

## Common Findings & Rules

| Semgrep Rule Pattern | CWE | AGENT_RULES.md Rule |
|---|---|---|
| \`*.xss.*\` | CWE-079 | Rule 2 |

## Next Steps
Review false negatives by CWE.
`;

function makeAgg(): AggregateMetrics {
  return {
    totalCases: 5, totalTp: 3, totalFp: 1, totalFn: 1, totalTn: 0,
    precision: 0.75, recall: 0.75, f1: 0.75,
    byCwe: new Map(), byTool: new Map(),
  };
}

function makeContext(overrides: Partial<ProposerContext> = {}): ProposerContext {
  return {
    iteration: 1,
    skillName: 'sast-scan',
    skillContent: MOCK_SKILL_CONTENT,
    aggregate: makeAgg(),
    metrics: [],
    unmapped: [],
    falsePositives: [],
    falseNegatives: [],
    triedChanges: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(loadTriedChanges).mockReturnValue([]);
});

describe('generateProposalFromRules', () => {
  it('returns null when no unmapped findings and no false negatives', () => {
    const result = generateProposalFromRules(makeContext());
    expect(result).toBeNull();
  });

  it('Strategy 1: generates proposal from unmapped finding with known CWE', () => {
    const result = generateProposalFromRules(makeContext({
      unmapped: [{ ruleId: 'python.lang.xss', cweFromTool: 'CWE-079', expectedCwe: 'CWE-079', caseId: 'case-1' }],
    }));
    expect(result).not.toBeNull();
    expect(result!.type).toBe('add_mapping');
    expect(result!.generator).toBe('rules');
    expect(result!.targetCwes).toContain('CWE-079');
    expect(result!.find).toBe('## Next Steps');
    expect(result!.replace).toContain('*.xss.*');
    expect(result!.replace).toContain('## Next Steps');
  });

  it('Strategy 1: skips unmapped findings where cweFromTool is UNKNOWN', () => {
    const result = generateProposalFromRules(makeContext({
      unmapped: [{ ruleId: 'python.lang.unknown', cweFromTool: 'UNKNOWN', expectedCwe: 'CWE-079', caseId: 'case-1' }],
    }));
    // Should fall through to strategy 2 (empty FNs) → null
    expect(result).toBeNull();
  });

  it('Strategy 1: prefers matching expectedCwe over non-matching', () => {
    const result = generateProposalFromRules(makeContext({
      unmapped: [
        { ruleId: 'rule.mismatch', cweFromTool: 'CWE-079', expectedCwe: 'CWE-089', caseId: 'case-1' },
        { ruleId: 'rule.match', cweFromTool: 'CWE-079', expectedCwe: 'CWE-079', caseId: 'case-2' },
      ],
    }));
    expect(result).not.toBeNull();
    expect(result!.hypothesis).toContain('case-2');
  });

  it('Strategy 2: generates proposal from false negative with known CWE', () => {
    const result = generateProposalFromRules(makeContext({
      falseNegatives: [{ caseId: 'fn-1', cwe: 'CWE-089', file: 'test.py', language: 'python' }],
    }));
    expect(result).not.toBeNull();
    expect(result!.type).toBe('add_mapping');
    expect(result!.targetCwes).toContain('CWE-089');
    expect(result!.replace).toContain('*.sql.injection.*');
    expect(result!.confidence).toBe(0.5);
  });

  it('Strategy 2: skips false negatives with unrecognized CWE pattern', () => {
    const result = generateProposalFromRules(makeContext({
      falseNegatives: [{ caseId: 'fn-1', cwe: 'CWE-999', file: 'test.py', language: 'python' }],
    }));
    expect(result).toBeNull();
  });

  it('anti-cycling: skips proposals already in tried_changes', () => {
    const anchor = '## Next Steps';
    const replaceStr = `| \`*.xss.*\` | CWE-079 | Rule 2: Injection Prevention |\n${anchor}`;

    vi.mocked(loadTriedChanges).mockReturnValue([{
      iteration: 1,
      timestamp: '2026-01-01T00:00:00Z',
      hypothesis: 'prev',
      file: 'skills/sast-scan/SKILL.md',
      find: anchor,
      replace: replaceStr,
      outcome: 'reject',
      f1Delta: -0.01,
      generator: 'rules',
    }]);

    const result = generateProposalFromRules(makeContext({
      unmapped: [{ ruleId: 'python.lang.xss', cweFromTool: 'CWE-079', expectedCwe: 'CWE-079', caseId: 'case-1' }],
    }));
    // The exact same find+replace was already tried — should skip it
    // (may fall through to strategy 2 or return null)
    if (result !== null) {
      // If a proposal was generated, it must NOT be the same as the tried change
      expect(`${result.find}|||${result.replace}`).not.toBe(`${anchor}|||${replaceStr}`);
    }
  });

  it('returns null when skillContent has no insertion anchor', () => {
    const result = generateProposalFromRules(makeContext({
      skillContent: '# No anchor here\nJust some text.',
      unmapped: [{ ruleId: 'python.lang.xss', cweFromTool: 'CWE-079', expectedCwe: 'CWE-079', caseId: 'case-1' }],
    }));
    expect(result).toBeNull();
  });

  it('uses skillName for the file field', () => {
    const result = generateProposalFromRules(makeContext({
      skillName: 'secrets-scan',
      skillContent: MOCK_SKILL_CONTENT,
      falseNegatives: [{ caseId: 'fn-1', cwe: 'CWE-798', file: 'config.py', language: 'python' }],
    }));
    expect(result).not.toBeNull();
    expect(result!.file).toBe('skills/secrets-scan/SKILL.md');
  });
});
