import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectProvider, buildDefaultConfig } from '../agent/llm-client.js';

describe('detectProvider', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) {
      if (origEnv[key] !== undefined) {
        process.env[key] = origEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it('returns Anthropic config when ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.OPENAI_API_KEY;
    const config = detectProvider();
    expect(config).not.toBeNull();
    expect(config!.provider).toBe('anthropic');
  });

  it('returns OpenAI config when only OPENAI_API_KEY is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    const config = detectProvider();
    expect(config).not.toBeNull();
    expect(config!.provider).toBe('openai');
  });

  it('returns null when neither key is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const config = detectProvider();
    expect(config).toBeNull();
  });

  it('prefers Anthropic when both keys are set', () => {
    process.env.ANTHROPIC_API_KEY = 'key-a';
    process.env.OPENAI_API_KEY = 'key-b';
    const config = detectProvider();
    expect(config!.provider).toBe('anthropic');
  });
});

describe('buildDefaultConfig', () => {
  it('sets correct default model for anthropic', () => {
    const config = buildDefaultConfig('anthropic');
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBeGreaterThan(0);
    expect(config.temperature).toBeGreaterThanOrEqual(0);
  });

  it('sets correct default model for openai', () => {
    const config = buildDefaultConfig('openai');
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('allows overriding the model', () => {
    const config = buildDefaultConfig('anthropic', 'claude-opus-4-20250514');
    expect(config.model).toBe('claude-opus-4-20250514');
  });
});

describe('callLlm error handling', () => {
  it('throws with missing key message when API key is not set', async () => {
    const { callLlm } = await import('../agent/llm-client.js');
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      callLlm({ provider: 'anthropic', model: 'test', maxTokens: 100, temperature: 0 }, [])
    ).rejects.toThrow(/ANTHROPIC_API_KEY|npm install/);
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  });
});
