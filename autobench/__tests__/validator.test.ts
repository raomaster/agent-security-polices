import { describe, it, expect } from 'vitest';
import { validateProposal } from '../agent/validator.js';
import type { Proposal, TriedChange } from '../types.js';

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    type: 'add_mapping',
    hypothesis: 'Test hypothesis',
    file: 'skills/sast-scan/SKILL.md',
    find: '## Next Steps',
    replace: '| `*.test.*` | CWE-079 | Rule 2 |\n\n## Next Steps',
    targetCwes: ['CWE-079'],
    expectedEffect: 'increase_recall',
    confidence: 0.8,
    generator: 'llm',
    ...overrides,
  };
}

function makeTriedChange(overrides: Partial<TriedChange> = {}): TriedChange {
  return {
    iteration: 1,
    timestamp: '2026-01-01T00:00:00Z',
    hypothesis: 'Previous attempt',
    file: 'skills/sast-scan/SKILL.md',
    find: '## Next Steps',
    replace: '| `*.old.*` | CWE-079 | Rule 2 |\n\n## Next Steps',
    outcome: 'reject',
    f1Delta: -0.01,
    generator: 'rules',
    ...overrides,
  };
}

describe('validateProposal', () => {
  it('fails when file is not in an allowed prefix', () => {
    const result = validateProposal(
      makeProposal({ file: 'autobench/runner.ts' }),
      []
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/allowed/i);
  });

  it('passes for skills/ prefix with valid find string', () => {
    const result = validateProposal(makeProposal({ file: 'skills/sast-scan/SKILL.md' }), []);
    expect(result.valid).toBe(true);
  });

  it('fails when find and replace are identical', () => {
    const result = validateProposal(
      makeProposal({ find: 'same content', replace: 'same content' }),
      []
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/identical/i);
  });

  it('fails when file does not exist', () => {
    const result = validateProposal(
      makeProposal({ file: 'skills/nonexistent-skill/SKILL.md' }),
      []
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/not found/i);
  });

  it('fails when find string is not in file', () => {
    const result = validateProposal(
      makeProposal({ find: 'THIS_STRING_DEFINITELY_DOES_NOT_EXIST_IN_ANY_FILE_XYZ' }),
      []
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/not found verbatim/i);
  });

  it('fails when same find+replace was already tried (anti-cycling)', () => {
    // Use a find string that actually exists in SKILL.md
    const findStr = '## Next Steps';
    const replaceStr = '| `*.test.*` | CWE-079 | Rule 2 |\n\n## Next Steps';
    const tried = makeTriedChange({ find: findStr, replace: replaceStr });
    const result = validateProposal(
      makeProposal({ find: findStr, replace: replaceStr }),
      [tried]
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/already tried/i);
  });

  it('passes when find differs but replace is same (not a duplicate)', () => {
    const tried = makeTriedChange({
      find: 'DIFFERENT_FIND',
      replace: '| `*.new.*` | CWE-079 | Rule 2 |\n\n## Next Steps',
    });
    const result = validateProposal(
      makeProposal({
        file: 'skills/sast-scan/SKILL.md',
        find: '## Next Steps',
        replace: '| `*.new.*` | CWE-079 | Rule 2 |\n\n## Next Steps',
      }),
      [tried]
    );
    // Same replace, different find — should NOT be flagged as anti-cycling
    expect(result.valid).toBe(true);
  });

  it('fails for AGENT_RULES.md with non-existent find string', () => {
    const result = validateProposal(
      makeProposal({
        file: 'AGENT_RULES.md',
        find: 'NONEXISTENT_STRING_IN_RULES_FILE',
      }),
      []
    );
    expect(result.valid).toBe(false);
    expect((result as any).reason).toMatch(/not found verbatim/i);
  });
});
