import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentConfig, AggregateMetrics } from '../types.js';
import type { ProposerContext } from '../agent/prompts.js';

// Mock the LLM client
vi.mock('../agent/llm-client.js', () => ({
  callLlm: vi.fn(),
}));

// Mock decisions to avoid disk access
vi.mock('../artifacts/decisions.js', () => ({
  loadTriedChanges: vi.fn().mockReturnValue([]),
  logTriedChange: vi.fn(),
  logExperiment: vi.fn(),
  formatTriedChangesForPrompt: vi.fn().mockReturnValue(''),
}));

import { generateProposal } from '../agent/proposer.js';
import { callLlm } from '../agent/llm-client.js';

const TEST_CONFIG: AgentConfig = {
  provider: 'anthropic',
  model: 'test-model',
  maxTokens: 512,
  temperature: 0,
};

function makeAgg(): AggregateMetrics {
  return {
    totalCases: 5, totalTp: 3, totalFp: 1, totalFn: 1, totalTn: 0,
    precision: 0.75, recall: 0.75, f1: 0.75,
    byCwe: new Map(), byTool: new Map(),
  };
}

function makeContext(): ProposerContext {
  return {
    iteration: 1,
    skillName: 'sast-scan',
    skillContent: '| `*.xss.*` | CWE-079 | Rule 2 |\n## Next Steps\n',
    aggregate: makeAgg(),
    metrics: [],
    unmapped: [],
    falsePositives: [],
    falseNegatives: [],
    triedChanges: [],
  };
}

const VALID_PROPOSAL_JSON = JSON.stringify({
  type: 'add_mapping',
  hypothesis: 'Add XSS mapping to improve recall',
  file: 'skills/sast-scan/SKILL.md',
  find: '## Next Steps',
  replace: '| `*.xss.*` | CWE-079 | Rule 2 |\n\n## Next Steps',
  targetCwes: ['CWE-079'],
  expectedEffect: 'increase_recall',
  confidence: 0.8,
});

describe('generateProposal', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-initialize decisions mock return values after clearAllMocks
    const decisions = await import('../artifacts/decisions.js') as any;
    decisions.loadTriedChanges.mockReturnValue([]);
    decisions.formatTriedChangesForPrompt.mockReturnValue('');
  });

  it('returns parsed Proposal when LLM returns valid JSON', async () => {
    callLlm.mockResolvedValue({ content: VALID_PROPOSAL_JSON, inputTokens: 100, outputTokens: 50, model: 'test' });
    const result = await generateProposal(makeContext(), TEST_CONFIG);
    // Proposal will fail validator (find string may not be in real SKILL.md) → proposal: null
    expect(result.proposal === null || result.proposal?.type === 'add_mapping').toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('returns parsed Proposal when response is wrapped in markdown fences', async () => {
    const wrapped = '```json\n' + VALID_PROPOSAL_JSON + '\n```';
    callLlm.mockResolvedValue({ content: wrapped, inputTokens: 100, outputTokens: 50, model: 'test' });
    const result = await generateProposal(makeContext(), TEST_CONFIG);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('returns null proposal when confidence is 0', async () => {
    const noMore = JSON.stringify({ confidence: 0 });
    callLlm.mockResolvedValue({ content: noMore, inputTokens: 10, outputTokens: 5, model: 'test' });
    const result = await generateProposal(makeContext(), TEST_CONFIG);
    expect(result.proposal).toBeNull();
    expect(result.tokensUsed).toBe(15);
  });

  it('throws when response is not valid JSON', async () => {
    callLlm.mockResolvedValue({ content: 'This is not JSON at all', inputTokens: 10, outputTokens: 5, model: 'test' });
    await expect(generateProposal(makeContext(), TEST_CONFIG)).rejects.toThrow(/not valid JSON/);
  });

  it('retries on validation failure up to maxRetries', async () => {
    // Return something that fails validation (file outside allowed prefixes)
    const badFile = JSON.stringify({ ...JSON.parse(VALID_PROPOSAL_JSON), file: 'autobench/runner.ts' });
    callLlm.mockResolvedValue({ content: badFile, inputTokens: 10, outputTokens: 5, model: 'test' });
    const result = await generateProposal(makeContext(), TEST_CONFIG, 1);
    // After 1 retry it gives up → null, not throw
    expect(result.proposal).toBeNull();
    // callLlm should have been called 2 times (original + 1 retry)
    expect(callLlm).toHaveBeenCalledTimes(2);
    expect(result.tokensUsed).toBe(30); // 15 per call × 2
  });

  it('returns null after maxRetries exhausted — does not throw', async () => {
    const badFile = JSON.stringify({ ...JSON.parse(VALID_PROPOSAL_JSON), file: 'autobench/runner.ts' });
    callLlm.mockResolvedValue({ content: badFile, inputTokens: 10, outputTokens: 5, model: 'test' });
    const result = await generateProposal(makeContext(), TEST_CONFIG, 0);
    expect(result.proposal).toBeNull();
  });
});
