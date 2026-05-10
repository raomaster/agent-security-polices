import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, type ProposerContext } from '../agent/prompts.js';
import type { AggregateMetrics } from '../types.js';

function makeAgg(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return {
    totalCases: 5,
    totalTp: 3,
    totalFp: 1,
    totalFn: 1,
    totalTn: 0,
    precision: 0.75,
    recall: 0.75,
    f1: 0.75,
    byCwe: new Map(),
    byTool: new Map(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<ProposerContext> = {}): ProposerContext {
  return {
    iteration: 1,
    skillName: 'sast-scan',
    skillContent: `# SAST Scan\n\n## Common Findings & Rules\n\n| Semgrep Rule Pattern | CWE | AGENT_RULES.md Rule |\n|---|---|---|\n| \`*.xss.*\` | CWE-79 | Rule 2 |\n\n## Next Steps\n`,
    aggregate: makeAgg(),
    metrics: [],
    unmapped: [],
    falsePositives: [],
    falseNegatives: [],
    triedChanges: [],
    ...overrides,
  };
}

describe('buildSystemPrompt', () => {
  it('contains "find" keyword', () => {
    expect(buildSystemPrompt()).toContain('"find"');
  });

  it('contains "replace" keyword', () => {
    expect(buildSystemPrompt()).toContain('"replace"');
  });

  it('contains "confidence" keyword', () => {
    expect(buildSystemPrompt()).toContain('"confidence"');
  });

  it('contains JSON output instruction', () => {
    expect(buildSystemPrompt()).toContain('JSON');
  });

  it('describes F1 scoring', () => {
    expect(buildSystemPrompt()).toContain('F1');
  });
});

describe('buildUserPrompt', () => {
  it('includes aggregate metrics section', () => {
    const prompt = buildUserPrompt(makeContext());
    expect(prompt).toContain('Aggregate Metrics');
    expect(prompt).toContain('F1:');
    expect(prompt).toContain('Precision:');
  });

  it('omits unmapped section when array is empty', () => {
    const prompt = buildUserPrompt(makeContext({ unmapped: [] }));
    expect(prompt).not.toContain('Unmapped Findings');
  });

  it('includes unmapped section when data is present', () => {
    const prompt = buildUserPrompt(makeContext({
      unmapped: [{ ruleId: 'python.lang.xss', cweFromTool: 'CWE-079', expectedCwe: 'CWE-079', caseId: 'case-1' }],
    }));
    expect(prompt).toContain('Unmapped Findings');
    expect(prompt).toContain('python.lang.xss');
  });

  it('omits false negatives section when array is empty', () => {
    const prompt = buildUserPrompt(makeContext({ falseNegatives: [] }));
    expect(prompt).not.toContain('False Negatives');
  });

  it('includes false negatives when present', () => {
    const prompt = buildUserPrompt(makeContext({
      falseNegatives: [{ caseId: 'fn-1', cwe: 'CWE-079', file: 'test.py', language: 'python' }],
    }));
    expect(prompt).toContain('False Negatives');
    expect(prompt).toContain('fn-1');
  });

  it('omits false positives section when array is empty', () => {
    const prompt = buildUserPrompt(makeContext({ falsePositives: [] }));
    expect(prompt).not.toContain('False Positives on Safe Code');
  });

  it('omits tried changes section when triedChanges is empty', () => {
    const prompt = buildUserPrompt(makeContext({ triedChanges: [] }));
    expect(prompt).not.toContain('Previously Tried Changes');
  });

  it('includes tried changes section when triedChanges is present', () => {
    const prompt = buildUserPrompt(makeContext({
      triedChanges: [{
        iteration: 1,
        timestamp: '2026-01-01T00:00:00Z',
        hypothesis: 'Add *.random.* → CWE-330',
        file: 'skills/sast-scan/SKILL.md',
        find: '## Next Steps',
        replace: '| `*.random.*` | CWE-330 | Rule 2 |\n\n## Next Steps',
        outcome: 'reject',
        f1Delta: -0.02,
        generator: 'rules',
      }],
    }));
    expect(prompt).toContain('Previously Tried Changes');
    expect(prompt).toContain('[REJECT]');
    expect(prompt).toContain('Add *.random.*');
  });

  it('includes iteration number in header', () => {
    const prompt = buildUserPrompt(makeContext({ iteration: 42 }));
    expect(prompt).toContain('42');
  });

  it('includes skill name in header', () => {
    const prompt = buildUserPrompt(makeContext({ skillName: 'secrets-scan' }));
    expect(prompt).toContain('secrets-scan');
  });
});
