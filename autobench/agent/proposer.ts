import type { Proposal, AgentConfig, LlmMessage } from '../types.js';
import type { ProposerContext } from './prompts.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { callLlm } from './llm-client.js';
import { validateProposal } from './validator.js';
import { loadTriedChanges } from '../artifacts/decisions.js';

/**
 * Generate a single improvement proposal using the LLM.
 *
 * Returns null when:
 * - LLM signals confidence === 0 (natural convergence)
 * - All retries exhausted (validation keeps failing)
 *
 * Throws when:
 * - LLM response cannot be parsed as JSON (likely a system error)
 */
export interface ProposalResult {
  proposal: Proposal | null;
  tokensUsed: number;
}

export async function generateProposal(
  context: ProposerContext,
  config: AgentConfig,
  maxRetries = 2
): Promise<ProposalResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const triedChanges = loadTriedChanges();
  let retries = 0;
  let totalTokens = 0;

  while (retries <= maxRetries) {
    const response = await callLlm(config, messages);
    totalTokens += response.inputTokens + response.outputTokens;
    let parsed: unknown;

    try {
      parsed = extractJson(response.content);
    } catch (err: any) {
      throw new Error(`LLM response is not valid JSON: ${err.message}\nRaw response: ${response.content.slice(0, 500)}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Expected JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
    }
    const obj = parsed as Record<string, unknown>;

    // Natural convergence signal
    if (obj.confidence === 0) {
      return { proposal: null, tokensUsed: totalTokens };
    }

    const proposal: Proposal = {
      type: obj.type as Proposal['type'],
      hypothesis: String(obj.hypothesis ?? ''),
      file: String(obj.file ?? ''),
      find: String(obj.find ?? ''),
      replace: String(obj.replace ?? ''),
      targetCwes: Array.isArray(obj.targetCwes) ? obj.targetCwes.map(String) : [],
      expectedEffect: obj.expectedEffect as Proposal['expectedEffect'],
      confidence: Number(obj.confidence ?? 0.5),
      generator: 'llm',
    };

    const validation = validateProposal(proposal, triedChanges);
    if (validation.valid) {
      return { proposal, tokensUsed: totalTokens };
    }

    retries++;
    if (retries > maxRetries) {
      console.warn(`  ⚠ Proposal failed validation after ${maxRetries} retries: ${validation.reason}`);
      return { proposal: null, tokensUsed: totalTokens };
    }

    // Extend conversation with validation feedback
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: `Validation failed: ${validation.reason}. Please provide a corrected proposal.`,
    });
  }

  return { proposal: null, tokensUsed: totalTokens };
}

function extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    return JSON.parse(match[1].trim());
  }

  throw new Error(`Could not extract JSON from: ${text.slice(0, 200)}`);
}
