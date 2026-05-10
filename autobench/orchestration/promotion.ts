import type { AggregateMetrics, PromotionDecision, PromotionGuard } from '../types.js';

export interface PromotionConfig {
  minF1Delta: number;                  // default 0.001
  allowedCriticalRecallDrop: number;   // default 0 (no regression allowed)
  allowedFpRateIncrease: number;       // default 0 (no increase allowed)
}

export const DEFAULT_PROMOTION_CONFIG: PromotionConfig = {
  minF1Delta: 0.001,
  allowedCriticalRecallDrop: 0,
  allowedFpRateIncrease: 0,
};

/**
 * Evaluate whether a proposed change should be promoted.
 *
 * Guards are evaluated in order. All must pass for outcome === 'promote'.
 * schemaValid and noCrash are passed as optional booleans (default true).
 */
export function evaluatePromotion(
  before: AggregateMetrics,
  after: AggregateMetrics,
  config: PromotionConfig = DEFAULT_PROMOTION_CONFIG,
  schemaValid = true,
  noCrash = true
): PromotionDecision {
  const rawF1Delta = after.f1 - before.f1;
  const guards: PromotionGuard[] = [];
  const reasons: string[] = [];

  // Guard 1: F1 must improve by at least minF1Delta
  // Compare raw value (not rounded) to avoid losing sub-threshold improvements
  const deltaF1Guard: PromotionGuard = {
    name: 'delta_f1',
    passed: rawF1Delta > config.minF1Delta,
    before: before.f1,
    after: after.f1,
    threshold: config.minF1Delta,
  };
  guards.push(deltaF1Guard);
  if (!deltaF1Guard.passed) reasons.push('delta_f1_below_threshold');

  // Guard 2: Critical recall must not regress
  // recallCritical is an optional field on AggregateMetrics populated by runner.ts.
  // Falls back to overall recall when not available (conservative approximation).
  const recallBefore = before.recallCritical ?? before.recall;
  const recallAfter  = after.recallCritical  ?? after.recall;
  const critRecallGuard: PromotionGuard = {
    name: 'critical_recall',
    passed: recallAfter >= recallBefore - config.allowedCriticalRecallDrop,
    before: recallBefore,
    after: recallAfter,
    threshold: config.allowedCriticalRecallDrop,
  };
  guards.push(critRecallGuard);
  if (!critRecallGuard.passed) reasons.push('critical_recall_regression');

  // Guard 3: FP rate on safe code must not increase
  const fpBefore = before.fpRateSafe ?? Math.min(before.totalFp / Math.max(before.totalCases, 1), 1);
  const fpAfter  = after.fpRateSafe  ?? Math.min(after.totalFp  / Math.max(after.totalCases,  1), 1);
  const fpRateGuard: PromotionGuard = {
    name: 'safe_fp_rate',
    passed: fpAfter <= fpBefore + config.allowedFpRateIncrease,
    before: fpBefore,
    after: fpAfter,
    threshold: config.allowedFpRateIncrease,
  };
  guards.push(fpRateGuard);
  if (!fpRateGuard.passed) reasons.push('fp_rate_on_safe_increased');

  // Guard 4: Schema valid
  const schemaGuard: PromotionGuard = {
    name: 'schema_valid',
    passed: schemaValid,
    before: 1,
    after: schemaValid ? 1 : 0,
  };
  guards.push(schemaGuard);
  if (!schemaGuard.passed) reasons.push('schema_validation_failed');

  // Guard 5: No adapter crash
  const crashGuard: PromotionGuard = {
    name: 'no_crash',
    passed: noCrash,
    before: 1,
    after: noCrash ? 1 : 0,
  };
  guards.push(crashGuard);
  if (!crashGuard.passed) reasons.push('adapter_crashed');

  const outcome = reasons.length === 0 ? 'promote' : 'reject';

  return { outcome, guards, f1Delta: round(rawF1Delta), reasons };
}

function round(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  // Normalize negative zero to positive zero
  return Object.is(r, -0) ? 0 : r;
}
