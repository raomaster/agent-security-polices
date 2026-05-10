import { describe, it, expect } from 'vitest';
import { evaluatePromotion, DEFAULT_PROMOTION_CONFIG } from '../orchestration/promotion.js';
import type { AggregateMetrics } from '../types.js';

function makeAgg(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return {
    totalCases: 10,
    totalTp: 5,
    totalFp: 2,
    totalFn: 3,
    totalTn: 0,
    precision: 0.714,
    recall: 0.625,
    f1: 0.667,
    byCwe: new Map(),
    byTool: new Map(),
    ...overrides,
  };
}

describe('evaluatePromotion', () => {
  it('promotes when F1 improves and all guards pass', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.650 });
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('promote');
    expect(result.f1Delta).toBeCloseTo(0.050, 3);
    expect(result.reasons).toHaveLength(0);
    expect(result.guards.every(g => g.passed)).toBe(true);
  });

  it('rejects when F1 delta is below threshold', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.600 });
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('reject');
    expect(result.reasons).toContain('delta_f1_below_threshold');
  });

  it('rejects when F1 delta is below threshold', () => {
    const before = makeAgg({ f1: 0.500 });
    const after  = makeAgg({ f1: 0.5005 }); // 0.0005 < 0.001
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('reject');
  });

  it('promotes when F1 delta exceeds threshold', () => {
    const before = makeAgg({ f1: 0.500 });
    const after  = makeAgg({ f1: 0.503 }); // 0.003 > 0.001
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('promote');
  });

  it('rejects when critical recall regresses', () => {
    const before = makeAgg({ f1: 0.600, recall: 0.800 }) as any;
    before.recallCritical = 0.800;
    const after = makeAgg({ f1: 0.650, recall: 0.700 }) as any;
    after.recallCritical = 0.700;
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('reject');
    expect(result.reasons).toContain('critical_recall_regression');
  });

  it('rejects when FP rate on safe code increases', () => {
    const before = makeAgg({ f1: 0.600 }) as any;
    before.fpRateSafe = 0.1;
    const after = makeAgg({ f1: 0.650 }) as any;
    after.fpRateSafe = 0.2;
    const result = evaluatePromotion(before, after);
    expect(result.outcome).toBe('reject');
    expect(result.reasons).toContain('fp_rate_on_safe_increased');
  });

  it('rejects when schema validation fails', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.650 });
    const result = evaluatePromotion(before, after, DEFAULT_PROMOTION_CONFIG, false, true);
    expect(result.outcome).toBe('reject');
    expect(result.reasons).toContain('schema_validation_failed');
  });

  it('rejects when adapter crashes', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.650 });
    const result = evaluatePromotion(before, after, DEFAULT_PROMOTION_CONFIG, true, false);
    expect(result.outcome).toBe('reject');
    expect(result.reasons).toContain('adapter_crashed');
  });

  it('returns all five guards in output', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.650 });
    const result = evaluatePromotion(before, after);
    const guardNames = result.guards.map(g => g.name);
    expect(guardNames).toContain('delta_f1');
    expect(guardNames).toContain('critical_recall');
    expect(guardNames).toContain('safe_fp_rate');
    expect(guardNames).toContain('schema_valid');
    expect(guardNames).toContain('no_crash');
  });

  it('each guard has correct passed boolean in output', () => {
    const before = makeAgg({ f1: 0.600 });
    const after  = makeAgg({ f1: 0.650 });
    const result = evaluatePromotion(before, after, DEFAULT_PROMOTION_CONFIG, false);
    const schemaGuard = result.guards.find(g => g.name === 'schema_valid')!;
    expect(schemaGuard.passed).toBe(false);
    const f1Guard = result.guards.find(g => g.name === 'delta_f1')!;
    expect(f1Guard.passed).toBe(true);
  });
});
