import type { AgentConfig, LlmMessage, LlmResponse, LlmProvider } from '../types.js';

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

// ─── Provider detection ──────────────────────────────────────────────

export function detectProvider(): AgentConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return buildDefaultConfig('anthropic');
  }
  if (process.env.OPENAI_API_KEY) {
    return buildDefaultConfig('openai');
  }
  return null;
}

export function buildDefaultConfig(
  provider: LlmProvider = 'anthropic',
  model?: string
): AgentConfig {
  return {
    provider,
    model: model ?? DEFAULT_MODELS[provider],
    maxTokens: 1024,
    temperature: 0.2,
  };
}

// ─── Unified LLM call ────────────────────────────────────────────────

export async function callLlm(
  config: AgentConfig,
  messages: LlmMessage[]
): Promise<LlmResponse> {
  if (config.provider === 'anthropic') {
    return callAnthropic(config, messages);
  }
  return callOpenAi(config, messages);
}

// ─── Anthropic ───────────────────────────────────────────────────────

async function callAnthropic(
  config: AgentConfig,
  messages: LlmMessage[]
): Promise<LlmResponse> {
  let Anthropic: any;
  try {
    const mod = await import('@anthropic-ai/sdk');
    Anthropic = mod.default ?? mod.Anthropic;
  } catch {
    throw new Error('Run: cd autobench && npm install @anthropic-ai/sdk');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY or OPENAI_API_KEY');

  const client = new Anthropic({ apiKey });

  // Anthropic expects system prompt separate from messages
  const systemMsg = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    messages: userMessages.map(m => ({ role: m.role, content: m.content })),
  });

  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error(`Anthropic returned no text block in response (${response.content.length} blocks)`);
  const content = (textBlock as any).text;

  return {
    content,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    model: response.model,
  };
}

// ─── OpenAI ──────────────────────────────────────────────────────────

async function callOpenAi(
  config: AgentConfig,
  messages: LlmMessage[]
): Promise<LlmResponse> {
  let OpenAI: any;
  try {
    const mod = await import('openai');
    OpenAI = mod.default ?? mod.OpenAI;
  } catch {
    throw new Error('Run: cd autobench && npm install openai');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Set OPENAI_API_KEY (or ANTHROPIC_API_KEY to switch providers)');

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const choice = response.choices[0];
  const content = choice?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content (possible token limit or content filter)');

  return {
    content,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    model: response.model,
  };
}
