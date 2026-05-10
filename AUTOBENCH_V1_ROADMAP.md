# AutoBench v1 — Implementation Spec

> **For the implementing agent:** Read this document completely before writing any code.
> Execute each work order in sequence. Do not skip phases. Do not add features beyond what is specified.
> The goal is a production-quality system — correct, testable, observable, and safe.

---

## What exists today

```
autobench/
  run.ts         CLI entry point
  runner.ts      Pipeline + loop orchestration
  skill.ts       SKILL.md parser
  executor.ts    Runs semgrep / gitleaks (Docker-first)
  evaluator.ts   TP/FP/FN → F1 metrics
  improver.ts    Improvement proposals — RULE-BASED (the core problem)
  fixer.ts       CWE → AGENT_RULES.md mapping (template-based)
  git.ts         commit / revert / isClean
  results.ts     TSV logging
  dashboard.ts   HTML dashboard
  types.ts       TypeScript interfaces
  program.md     Agent instructions (markdown)

benchmarks/      13 CWE categories, 33 cases, ground truth JSON
skills/          SKILL.md files that the loop improves
policies/        YAML policy files
```

## What is broken today (must fix before building)

| ID | Bug | File | Line |
|----|-----|------|------|
| B1 | Baseline never updated after KEEP — loop analyzes stale failures | `runner.ts` | 291, 340 |
| B2 | CWE-330 and CWE-532 excluded from sast-scan benchmark | `runner.ts` | 27 |
| B3 | `evaluateCase()` duplicates `evaluator.ts::evaluate()` with diverging logic | `runner.ts` | 53–85 |
| B4 | IaC adapters silently return `[]` — caller cannot distinguish "no findings" from "not implemented" | `executor.ts` | 22 |
| B5 | CWE normalization done ad-hoc in 3 different places — inconsistent padding | `skill.ts:52`, `runner.ts:62`, `executor.ts:115` | — |
| B6 | `logMetrics` receives `Date.now()` as run_id — produces float timestamps instead of sequential integers | `runner.ts` | 298, 361 |

## What is architecturally wrong (must redesign)

**`improver.ts` is a static lookup table.** It can propose at most 10 unique changes, then the loop terminates with "No improvements to try." This is the fundamental gap between what the system claims to do (self-improvement) and what it actually does (run a fixed list of checks once).

The fix is to replace `improver.ts` with an LLM agent that generates hypotheses from the actual failure data, using the history of tried changes as context. The LLM never decides whether a change is kept — that is always the deterministic evaluator.

---

## Invariants — never violate these

1. `benchmarks/` is immutable ground truth. No code path writes to it.
2. The promotion decision is always based on `eval(before)` vs `eval(after)` — never on LLM output.
3. `autobench/` code is never the target of its own improvement loop.
4. The user's active git branch is never touched during a loop run.
5. A "fix" is only a fix if the re-scan confirms the finding is gone.

---

## Work Order 0 — Bug Fixes

**Do this first. Nothing else builds correctly without it.**

### W0.1 — Fix baseline refresh (B1)

In `runner.ts`, function `runAutoLearningLoop`:

Change line 291:
```typescript
// BEFORE
const baseline = await runBenchmarkOnce(skillName, options);

// AFTER
let baseline = await runBenchmarkOnce(skillName, options);
```

Inside the KEEP branch (after line 348), add:
```typescript
// Refresh baseline so next iteration analyzes current failures, not iter-0 failures
baseline = result;
```

**Why:** Without this, every iteration proposes improvements against the same stale failure list. After keeping a change that fixes CWE-330 false negatives, the next iteration will still "see" those false negatives and propose the same fix again.

### W0.2 — Fix missing CWEs (B2)

In `runner.ts`, line 27, change:
```typescript
// BEFORE
'sast-scan': ['CWE-079', 'CWE-089', 'CWE-078', 'CWE-327', 'CWE-502', 'CWE-022', 'CWE-287', 'CWE-862'],

// AFTER
'sast-scan': ['CWE-079', 'CWE-089', 'CWE-078', 'CWE-327', 'CWE-502', 'CWE-022', 'CWE-287', 'CWE-862', 'CWE-330', 'CWE-532'],
```

### W0.3 — Remove duplicate evaluateCase (B3)

In `runner.ts`, delete the `evaluateCase` function (lines 53–85) and the `MappedFinding` interface (lines 34–38).

Replace all calls to `evaluateCase(benchCase, mapped)` with a call to `evaluator.ts::evaluate()`, passing `mapped` after converting `skillCwe` → `cwe` field:

```typescript
import { evaluate } from './evaluator.js';

// Before calling evaluate, remap skillCwe onto cwe so the evaluator sees normalized CWEs
const remapped: ScanFinding[] = mapped.map(f => ({ ...f, cwe: f.skillCwe || f.cwe }));
const metrics = evaluate(benchCase, remapped, skill.tool, duration);
```

### W0.4 — IaC adapter explicit error (B4)

In `executor.ts`, replace the silent `default: return []` with:
```typescript
default:
  console.warn(`  ⚠ Adapter "${skill.tool}" is not yet implemented. Returning no findings.`);
  return [];
```

### W0.5 — Centralize CWE normalization (B5)

Create `autobench/normalization/cwe.ts`:

```typescript
/**
 * Normalize any CWE representation to "CWE-NNN" with zero-padded 3-digit number.
 * Handles: "CWE-79", "CWE079", "79", "CWE-79: ...", ["CWE-79"]
 */
export function normalizeCwe(raw: unknown): string {
  if (!raw) return 'UNKNOWN';
  const s = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const match = s.match(/CWE-?(\d+)/i);
  if (!match) return 'UNKNOWN';
  return `CWE-${match[1].padStart(3, '0')}`;
}
```

Replace all ad-hoc CWE formatting in `skill.ts`, `runner.ts`, and `executor.ts` with `normalizeCwe()`. Delete local CWE-parsing code from those files.

### W0.6 — Sequential run IDs (B6)

In `runner.ts`, replace all calls `logMetrics(Date.now(), ...)` and `logAggregate(Date.now(), ...)` with a sequential integer run ID:

```typescript
let runId = 0;  // declare before loop
// In iteration: pass runId, increment after
logAggregate(runId, baseline.aggregate, 'baseline', 'iter-0');
runId++;
// ... inside loop:
logMetrics(runId, m, ...);
logAggregate(runId, result.aggregate, ...);
runId++;
```

---

## Work Order 1 — Data Contracts

**Define typed contracts before building any new modules. Every module from W2 onward consumes these types.**

### W1.1 — Extend `autobench/types.ts`

Add the following interfaces. Do not remove existing ones.

```typescript
// ── Normalized Finding (canonical form, all adapters output this) ────────────

export interface NormalizedFinding {
  id: string;              // sha-256 of (tool + file + line + ruleId), hex, first 16 chars
  source: 'autobench' | 'ci' | 'manual';
  tool: 'semgrep' | 'gitleaks' | 'kics' | 'trivy';
  file: string;            // relative path, forward slashes
  line: number;
  cwe: string;             // always "CWE-NNN", e.g. "CWE-079"
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;      // 0–100
  ruleId: string;
  ruleMapping: string | null;  // matched SKILL.md pattern, null if unmapped
  message: string;
  fixable: boolean;
  status: 'raw' | 'mapped' | 'triaged' | 'fixed' | 'verified';
}

// ── Proposal types ────────────────────────────────────────────────────────────

export type ProposalType =
  | 'add_mapping'      // add a new row to the SKILL.md CWE table
  | 'remove_mapping'   // delete an overly broad or incorrect row
  | 'modify_mapping'   // update an existing pattern
  | 'add_exclusion'    // suppress FPs matching a pattern
  | 'change_severity'  // adjust the severity for a CWE
  | 'add_fix_rule';    // add a CWE → AGENT_RULES rule mapping

export interface Proposal {
  type: ProposalType;
  hypothesis: string;      // why this change should improve F1
  file: string;            // path relative to repo root
  find: string;            // exact verbatim string to locate in file
  replace: string;         // exact replacement (must differ from find)
  targetCwes: string[];    // e.g. ["CWE-330"]
  expectedEffect: 'increase_recall' | 'increase_precision' | 'both';
  confidence: number;      // 0.0–1.0; return 0 to signal "no more proposals"
  generator: 'llm' | 'rules';
}

// ── Promotion ─────────────────────────────────────────────────────────────────

export interface ProtectedMetrics {
  recallCritical: number;  // recall on CRITICAL+HIGH benchmark cases only
  fpRateSafe: number;      // FP rate on vulnerable:false fixture cases
}

export interface PromotionGuard {
  name: string;
  passed: boolean;
  before: number;
  after: number;
  threshold?: number;
}

export interface PromotionDecision {
  outcome: 'promote' | 'reject' | 'failed_to_apply';
  guards: PromotionGuard[];
  f1Delta: number;
  reasons: string[];       // machine-readable, e.g. "delta_f1_below_threshold"
}

// ── Experiment record (one per iteration, written to decisions.jsonl) ─────────

export interface ExperimentRecord {
  experimentId: string;    // UUID v4
  parentBaselineId: string; // git commit hash
  iteration: number;
  timestamp: string;       // ISO 8601
  skillName: string;
  proposal: Proposal;
  beforeMetrics: AggregateMetricsSummary;
  afterMetrics: AggregateMetricsSummary;
  decision: PromotionDecision;
  durationMs: number;
  llmTokensUsed: number;   // 0 for rule-based generator
  artifactPaths: {
    patch: string;
    beforeFindings: string;
    afterFindings: string;
    llmPrompt?: string;
    llmResponse?: string;
  };
}

export interface AggregateMetricsSummary {
  f1: number;
  precision: number;
  recall: number;
  recallCritical: number;
  fpRateSafe: number;
  totalCases: number;
  totalTp: number;
  totalFp: number;
  totalFn: number;
}

// ── LLM client ────────────────────────────────────────────────────────────────

export type LlmProvider = 'anthropic' | 'openai';

export interface AgentConfig {
  provider: LlmProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// ── Anti-cycling ──────────────────────────────────────────────────────────────

export interface TriedChange {
  iteration: number;
  timestamp: string;
  hypothesis: string;
  file: string;
  find: string;
  replace: string;
  outcome: 'promote' | 'reject' | 'failed_to_apply';
  f1Delta: number;
  generator: 'llm' | 'rules';
}
```

### W1.2 — Create `autobench/normalization/cwe.ts`

Done in W0.5 above. No additional work needed.

### W1.3 — Create `autobench/normalization/severity.ts`

```typescript
// Tool-specific severity strings → unified levels
const SEMGREP_MAP: Record<string, NormalizedFinding['severity']> = {
  ERROR:   'HIGH',
  WARNING: 'MEDIUM',
  INFO:    'LOW',
};

const GITLEAKS_MAP: Record<string, NormalizedFinding['severity']> = {
  // gitleaks does not emit severity — default to HIGH for secrets
};

export function normalizeSeverity(
  raw: string | undefined,
  tool: NormalizedFinding['tool']
): NormalizedFinding['severity'] {
  if (!raw) return tool === 'gitleaks' ? 'HIGH' : 'MEDIUM';
  const upper = raw.toUpperCase();
  if (tool === 'semgrep') return SEMGREP_MAP[upper] ?? 'MEDIUM';
  if (['CRITICAL','HIGH','MEDIUM','LOW'].includes(upper)) {
    return upper as NormalizedFinding['severity'];
  }
  return 'MEDIUM';
}
```

---

## Work Order 2 — Promotion Engine

**Build this standalone module before touching the loop. It has no dependencies on the LLM.**

Create `autobench/orchestration/promotion.ts`:

```typescript
import type { AggregateMetrics, PromotionDecision, PromotionGuard } from '../types.js';

export interface PromotionConfig {
  minF1Delta: number;       // default 0.001
  allowedCriticalRecallDrop: number;  // default 0 (no regression)
  allowedFpRateIncrease: number;      // default 0 (no increase)
}

export const DEFAULT_PROMOTION_CONFIG: PromotionConfig = {
  minF1Delta: 0.001,
  allowedCriticalRecallDrop: 0,
  allowedFpRateIncrease: 0,
};

export function evaluatePromotion(
  before: AggregateMetrics,
  after: AggregateMetrics,
  config: PromotionConfig = DEFAULT_PROMOTION_CONFIG
): PromotionDecision {
  // ...
}
```

The function evaluates five guards in order. If any guard fails, outcome is `reject`:

| Guard name | Condition to PASS | Reason string on failure |
|------------|------------------|--------------------------|
| `delta_f1` | `after.f1 - before.f1 > config.minF1Delta` | `"delta_f1_below_threshold"` |
| `critical_recall` | `after.recallCritical >= before.recallCritical - config.allowedCriticalRecallDrop` | `"critical_recall_regression"` |
| `safe_fp_rate` | `after.fpRateSafe <= before.fpRateSafe + config.allowedFpRateIncrease` | `"fp_rate_on_safe_increased"` |
| `schema_valid` | passed as parameter (boolean from artifact writer) | `"schema_validation_failed"` |
| `no_crash` | passed as parameter | `"adapter_crashed"` |

Return a `PromotionDecision` with all guards, outcome, f1Delta, and reasons array.

**Tests** (`autobench/__tests__/promotion.test.ts`):

Write tests that verify:
- F1 improved but critical recall dropped → reject
- F1 improved but FP on safe code increased → reject
- F1 improved, all guards pass → promote
- F1 at exactly `minF1Delta` threshold → promote
- F1 below threshold → reject
- Each guard's `passed` boolean is correct in the output

---

## Work Order 3 — Decision Logger

Create `autobench/artifacts/decisions.ts`. No dependencies on LLM or agent.

```typescript
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExperimentRecord, TriedChange } from '../types.js';

const RESULTS_DIR = resolve(import.meta.dirname, '../..', 'results');
const DECISIONS_PATH = resolve(RESULTS_DIR, 'decisions.jsonl');
const TRIED_PATH = resolve(RESULTS_DIR, 'tried_changes.jsonl');

export function logExperiment(record: ExperimentRecord): void
export function logTriedChange(change: TriedChange): void
export function loadTriedChanges(): TriedChange[]
export function loadExperiments(): ExperimentRecord[]

// Returns a compact text block for insertion into the LLM user prompt.
// Shows at most the last `limit` entries (default 20).
// Format: "[REJECT] iter 3 — Add *.random.* → CWE-330 — ΔF1: -0.02"
export function formatTriedChangesForPrompt(limit?: number): string
```

Implementation notes:
- Each function that writes must call `mkdirSync(RESULTS_DIR, { recursive: true })` first
- JSONL: one JSON object per line, no trailing comma, newline-terminated
- `loadTriedChanges` returns `[]` if file does not exist (not an error)
- `formatTriedChangesForPrompt` truncates hypothesis to 80 chars max per line

**Tests** (`autobench/__tests__/decisions.test.ts`):
- Append + read round-trip for both file types
- `formatTriedChangesForPrompt` respects the `limit` param
- Returns correct format with REJECT/PROMOTE labels and ΔF1
- Handles empty file and non-existent file gracefully

---

## Work Order 4 — LLM Client

Create `autobench/agent/llm-client.ts`.

Requirements:
- Zero hard dependencies. Both SDKs are `optionalDependencies` loaded via dynamic `import()`.
- Auto-detect provider: if `ANTHROPIC_API_KEY` is set, use Anthropic; if `OPENAI_API_KEY` is set, use OpenAI; if both, prefer Anthropic.
- `--provider` CLI flag overrides auto-detection.
- Default models: `claude-sonnet-4-20250514` (Anthropic), `gpt-4o` (OpenAI).

```typescript
import type { AgentConfig, LlmMessage, LlmResponse } from '../types.js';

export async function callLlm(
  config: AgentConfig,
  messages: LlmMessage[]
): Promise<LlmResponse>

export function detectProvider(): AgentConfig | null  // returns null if no key found

export function buildDefaultConfig(
  provider?: LlmProvider,
  model?: string
): AgentConfig
```

Error handling:
- If SDK not installed: throw with message `'Run: cd autobench && npm install @anthropic-ai/sdk'`
- If API key missing: throw with message `'Set ANTHROPIC_API_KEY or OPENAI_API_KEY'`
- If API call fails: throw with provider error message preserved

**Tests** (`autobench/__tests__/llm-client.test.ts`):
- `detectProvider` returns Anthropic config when `ANTHROPIC_API_KEY` is set
- `detectProvider` returns OpenAI config when only `OPENAI_API_KEY` is set
- `detectProvider` returns null when neither is set
- `buildDefaultConfig` sets correct default model per provider
- Verify the dynamic import error message contains the install command

---

## Work Order 5 — Proposal Validator

Create `autobench/agent/validator.ts`.

```typescript
import type { Proposal, TriedChange } from '../types.js';
import { parseSkillMd } from '../skill.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

const ALLOWED_TARGET_PREFIXES = [
  'skills/',
  'policies/',
  'AGENT_RULES.md',
];

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateProposal(
  proposal: Proposal,
  triedChanges: TriedChange[]
): ValidationResult
```

Validates in this exact order (return on first failure):

1. `proposal.file` starts with one of `ALLOWED_TARGET_PREFIXES`
2. `proposal.find !== proposal.replace`
3. File at `proposal.file` exists and can be read
4. `proposal.find` exists verbatim in the file content
5. No entry in `triedChanges` has identical `find + replace` as this proposal
6. After applying `content.replace(proposal.find, proposal.replace)`, `parseSkillMd()` does not throw (only validate if file is a SKILL.md)

Return `{ valid: false, reason: '<specific reason>' }` for each failure case. The reason will be appended to the LLM retry message.

**Tests** (`autobench/__tests__/validator.test.ts`):
- One test per validation rule, both passing and failing case
- Anti-cycling: identical find+replace in triedChanges → invalid
- Near-identical but different replace string → valid

---

## Work Order 6 — Prompts

Create `autobench/agent/prompts.ts`.

This module has no I/O. It builds strings from data. It is pure.

```typescript
import type { AggregateMetrics, Metrics, TriedChange } from '../types.js';

export interface ProposerContext {
  iteration: number;
  skillName: string;
  skillContent: string;          // full content of the target SKILL.md
  aggregate: AggregateMetrics;
  metrics: Metrics[];
  unmapped: UnmappedFinding[];
  falsePositives: FailureCase[];
  falseNegatives: FailureCase[];
  triedChanges: TriedChange[];
}

export interface UnmappedFinding {
  ruleId: string;
  cweFromTool: string;     // CWE Semgrep reported
  expectedCwe: string;     // CWE ground truth expects
  caseId: string;
}

export interface FailureCase {
  caseId: string;
  cwe: string;
  file: string;
  language: string;
}

export function buildSystemPrompt(): string
export function buildUserPrompt(context: ProposerContext): string
```

### System prompt content (implement exactly this)

```
You are a security engineer improving a SAST skill configuration.

The pipeline works as follows:
  Semgrep runs on code → produces findings with ruleIds
  A SKILL.md mapping table converts ruleIds to CWEs via glob patterns
  Mapped findings are scored against labeled benchmark cases

Scoring:
  TP  — finding mapped to correct CWE, within ±2 lines of ground truth
  FP  — finding on safe code (vulnerable:false), or mapped to wrong CWE
  FN  — ground truth vulnerability not detected or not correctly mapped
  F1  — harmonic mean of precision and recall (higher is better)

Your role:
  Analyze the benchmark results and propose ONE targeted change to the
  SKILL.md mapping table that will improve F1 without increasing the FP
  rate on safe-code fixtures.

Output format — respond with a single JSON object, no other text:
  {
    "type": "add_mapping|remove_mapping|modify_mapping|add_exclusion|change_severity|add_fix_rule",
    "hypothesis": "one sentence explaining why this improves F1",
    "file": "path/relative/to/repo/root",
    "find": "exact verbatim string to find in the file",
    "replace": "exact replacement string",
    "targetCwes": ["CWE-NNN"],
    "expectedEffect": "increase_recall|increase_precision|both",
    "confidence": 0.0
  }

Rules:
  - ONE change per response
  - "find" must exist verbatim in the current file content shown below
  - Changes must be generalizable — never reference specific test filenames as patterns
  - Never use patterns broader than needed (avoid .*, prefer *.xss.*)
  - Never repeat a change from "Previously tried changes"
  - If no further useful change exists, respond with confidence: 0
```

### User prompt structure

Build sections in this order. Each section is only included if it has data.

```
## Iteration {N} — {skillName}

### Aggregate Metrics
F1: {f1} | Precision: {precision} | Recall: {recall}
TP: {tp} | FP: {fp} | FN: {fn}
Critical recall: {recallCritical} | FP rate (safe code): {fpRateSafe}

### Per-CWE Breakdown
{table: CWE | Cases | Precision | Recall | F1}

### Unmapped Findings — top 10 by expected CWE
These ruleIds were detected but are NOT in the mapping table:
{list: ruleId → tool's CWE (expected: benchmark CWE) — case: caseId}

### False Negatives — top 5
Ground truth vulnerabilities that were not detected:
{list: caseId (CWE) in file.ext [language]}

### False Positives on Safe Code — top 5
Safe fixtures incorrectly flagged:
{list: caseId (CWE)}

### Current Mapping Table (from {file})
{verbatim content of the | Pattern | CWE | Rule | table section only}

### Previously Tried Changes (last 20)
{output of formatTriedChangesForPrompt(20)}
```

Truncation rules:
- Unmapped: top 10 by frequency of expected CWE in benchmark cases
- FN / FP: top 5 by CWE severity (CRITICAL first)
- Tried changes: last 20 by iteration number

**Tests** (`autobench/__tests__/prompts.test.ts`):
- `buildSystemPrompt()` contains "find" and "replace" and "confidence"
- `buildUserPrompt()` includes aggregate metrics section
- Empty unmapped/FP/FN arrays produce no corresponding section
- Tried changes section is omitted when `triedChanges` is empty
- JSON output instruction is present in system prompt

---

## Work Order 7 — LLM Proposer

Create `autobench/agent/proposer.ts`. This is the core agent module.

```typescript
import type { Proposal, AgentConfig } from '../types.js';
import type { ProposerContext } from './prompts.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { callLlm } from './llm-client.js';
import { validateProposal } from './validator.js';
import { loadTriedChanges } from '../artifacts/decisions.js';

export async function generateProposal(
  context: ProposerContext,
  config: AgentConfig,
  maxRetries = 2
): Promise<Proposal | null>
```

Implementation:

```
1. Build system prompt and initial user prompt from context
2. Call callLlm() with [system, user] messages
3. Parse JSON from response (strip markdown fences if present)
4. If parse fails: throw with raw response in message
5. If confidence === 0: return null (natural convergence)
6. Validate proposal with validateProposal()
7. If valid: return proposal
8. If invalid and retries remain:
     append { role: 'assistant', content: rawResponse }
     append { role: 'user', content: `Validation failed: ${reason}. Try again.` }
     call callLlm() again with extended conversation
     goto step 3
9. If invalid after maxRetries: return null, log warning
```

JSON extraction utility (handle both raw JSON and ```json ... ``` blocks):

```typescript
function extractJson(text: string): unknown {
  // Try direct parse first
  try { return JSON.parse(text.trim()); } catch {}
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return JSON.parse(match[1].trim());
  throw new Error(`Could not extract JSON from: ${text.slice(0, 200)}`);
}
```

**Tests** (`autobench/__tests__/proposer.test.ts`):
- Mock `callLlm` to return valid JSON → returns parsed Proposal
- Mock returns JSON in markdown fences → still parses correctly
- Mock returns `confidence: 0` → returns null
- Mock returns invalid JSON → throws with helpful message
- Mock returns proposal that fails validation → retries up to maxRetries
- After maxRetries failures → returns null, does not throw

---

## Work Order 8 — Rule-Based Fallback

Create `autobench/agent/proposer-rules.ts`.

This module preserves the existing `improver.ts` logic but wraps it in the same `generateProposal` interface. When no API key is configured, the runner calls this instead.

```typescript
import type { Proposal } from '../types.js';
import type { ProposerContext } from './prompts.js';

export function generateProposalFromRules(
  context: ProposerContext
): Proposal | null
```

Port the existing logic from `improver.ts` — `proposeImprovements()`, `suggestSemgrepPattern()`, `extractPatternFromRuleId()` — adapted to return `Proposal | null` instead of `Improvement[]`.

Mark `improver.ts` as `@deprecated` with a JSDoc comment pointing to the new location. Do not delete it yet (it may still be imported by tests).

---

## Work Order 9 — Runner Upgrade

Refactor `autobench/runner.ts` `runAutoLearningLoop()` to use the new agent and promotion modules.

### 9.1 — Imports to add

```typescript
import { generateProposal } from './agent/proposer.js';
import { generateProposalFromRules } from './agent/proposer-rules.js';
import { validateProposal } from './agent/validator.js';
import { buildSystemPrompt, buildUserPrompt } from './agent/prompts.js';
import { evaluatePromotion, DEFAULT_PROMOTION_CONFIG } from './orchestration/promotion.js';
import { logExperiment, logTriedChange, loadTriedChanges } from './artifacts/decisions.js';
import { detectProvider, buildDefaultConfig } from './agent/llm-client.js';
import type { Proposal, AgentConfig } from './types.js';
import { randomUUID } from 'node:crypto';
```

### 9.2 — Branch isolation

At the start of `runAutoLearningLoop`, before the baseline run:

```typescript
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const branchName = `autobench/run-${ts}`;
git(['checkout', '-b', branchName]);
console.log(`  Branch: ${branchName}`);
```

### 9.3 — Agent config setup

```typescript
const agentConfig = options.provider
  ? buildDefaultConfig(options.provider as LlmProvider, options.model)
  : (detectProvider() ?? null);

const usingLlm = agentConfig !== null;
if (!usingLlm) {
  console.log('  No API key detected — using rule-based proposer (set ANTHROPIC_API_KEY for LLM mode)');
}
```

### 9.4 — Replace proposal generation

Replace the `proposeImprovements` call with:

```typescript
const triedChanges = loadTriedChanges();
const skillPath = resolve(import.meta.dirname, '..', 'skills', skillName, 'SKILL.md');
const skillContent = readFileSync(skillPath, 'utf-8');

const context: ProposerContext = {
  iteration: i,
  skillName,
  skillContent,
  aggregate: baseline.aggregate,
  metrics: baseline.metrics,
  unmapped: baseline.unmapped,
  falsePositives: baseline.falsePositives,
  falseNegatives: baseline.falseNegatives,
  triedChanges,
};

let proposal: Proposal | null = null;

if (options.dryRun) {
  console.log('\n  ── DRY RUN: LLM prompt ──────────────────────────');
  console.log(buildSystemPrompt());
  console.log(buildUserPrompt(context));
  console.log('  ────────────────────────────────────────────────\n');
  break;
}

if (usingLlm) {
  proposal = await generateProposal(context, agentConfig!);
} else {
  proposal = generateProposalFromRules(context);
}

if (!proposal || proposal.confidence === 0) {
  console.log('  No further proposals. Loop complete.');
  break;
}
```

### 9.5 — Apply via find/replace

Replace `applyImprovement(improvement)` with:

```typescript
const filePath = resolve(import.meta.dirname, '..', proposal.file);
const before = readFileSync(filePath, 'utf-8');
const after = before.replace(proposal.find, proposal.replace);
writeFileSync(filePath, after, 'utf-8');
```

### 9.6 — Replace promotion check

Replace the `comparison.improved` check with:

```typescript
const decision = evaluatePromotion(baseline.aggregate, result.aggregate);

if (decision.outcome === 'promote') {
  baseline = result;   // W0.1 fix
  bestF1 = result.aggregate.f1;
  bestHash = getCommitHash();
  keepCount++;
} else {
  discardCount++;
  revertTo(bestHash);
}
```

### 9.7 — Log experiment record

After every iteration (keep or revert):

```typescript
const record: ExperimentRecord = {
  experimentId: randomUUID(),
  parentBaselineId: bestHash,
  iteration: i,
  timestamp: new Date().toISOString(),
  skillName,
  proposal,
  beforeMetrics: toSummary(baseline.aggregate),
  afterMetrics: toSummary(result.aggregate),
  decision,
  durationMs: Date.now() - iterStart,
  llmTokensUsed: 0,  // TODO: capture from callLlm response in W10
  artifactPaths: { patch: '', beforeFindings: '', afterFindings: '' },
};

logExperiment(record);
logTriedChange({
  iteration: i,
  timestamp: record.timestamp,
  hypothesis: proposal.hypothesis,
  file: proposal.file,
  find: proposal.find,
  replace: proposal.replace,
  outcome: decision.outcome === 'promote' ? 'promote' : 'reject',
  f1Delta: decision.f1Delta,
  generator: proposal.generator,
});
```

### 9.8 — SIGINT handler

```typescript
let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) process.exit(1);   // second Ctrl+C = force quit
  interrupted = true;
  console.log('\n  Interrupted. Finishing current iteration before stopping...');
});

// Check at start of each loop iteration
if (interrupted) {
  console.log(`  Stopped at iteration ${i - 1}.`);
  break;
}
```

---

## Work Order 10 — CLI Updates

In `autobench/cli/run.ts` (or `autobench/run.ts` — wherever the CLI lives), extend argument parsing:

Add to switch statement:
```typescript
case '--provider': options.provider = args[++i]; break;
case '--model':    options.model    = args[++i]; break;
case '--dry-run':  options.dryRun   = true;      break;
```

Add to `BenchOptions` interface in `types.ts`:
```typescript
provider?: string;
model?: string;
dryRun?: boolean;
```

Update `showHelp()` to document:
```
--provider <name>    LLM provider: anthropic | openai (default: auto-detect)
--model <name>       Override LLM model for the selected provider
--dry-run            Print the LLM prompt without calling the API or modifying files
```

---

## Work Order 11 — Package Dependencies

In `autobench/package.json`, add:

```json
"optionalDependencies": {
  "@anthropic-ai/sdk": "^0.39.0",
  "openai": "^4.77.0"
}
```

After adding, run `npm install` in `autobench/` to update `package-lock.json`.

---

## Work Order 12 — Acceptance Test Run

Execute the following sequence to verify the full system end-to-end. All steps must pass before declaring the implementation complete.

```bash
# 1. Unit tests — all must pass
cd autobench && npx vitest run

# 2. Baseline run — must complete without error, F1 > 0
npx tsx run.ts

# 3. Dry run — must print prompt, not call LLM, not modify files
npx tsx run.ts --loop --dry-run

# 4. Single LLM iteration — requires API key
ANTHROPIC_API_KEY=... npx tsx run.ts --loop --iterations 1 --verbose

# 5. Verify experiment record written
cat ../results/decisions.jsonl | head -1 | python3 -m json.tool

# 6. Verify tried changes written
cat ../results/tried_changes.jsonl | head -1 | python3 -m json.tool

# 7. Verify baseline refreshes — run 2 iterations, confirm iter-2 analyzes iter-1 state
ANTHROPIC_API_KEY=... npx tsx run.ts --loop --iterations 2 --verbose

# 8. Verify anti-cycling — tried_changes from step 6 must appear in iter-2 prompt
# (check with --dry-run after step 6)
ANTHROPIC_API_KEY=... npx tsx run.ts --loop --dry-run

# 9. Verify rule-based fallback (no API key)
npx tsx run.ts --loop --iterations 5

# 10. Dashboard — must generate without error
npx tsx run.ts --dashboard && open ../results/dashboard/index.html
```

---

## Work Order 13 — README Update

After all work orders pass, update `autobench/README.md` to reflect the new CLI options and loop behavior. Specifically:

- Add `--provider`, `--model`, `--dry-run` to the commands table
- Update the "Auto-learning loop" section to describe LLM mode vs rule-based fallback
- Add a section "Monitoring a running loop" with the `jq` commands for watching `decisions.jsonl`

Do not rewrite the existing README — add to it.

---

## File change summary

| File | Action | Work order |
|------|--------|-----------|
| `autobench/runner.ts` | Modify — bug fixes + agent integration | W0, W9 |
| `autobench/types.ts` | Modify — add new interfaces | W1.1 |
| `autobench/normalization/cwe.ts` | Create | W0.5 |
| `autobench/normalization/severity.ts` | Create | W1.3 |
| `autobench/orchestration/promotion.ts` | Create | W2 |
| `autobench/artifacts/decisions.ts` | Create | W3 |
| `autobench/agent/llm-client.ts` | Create | W4 |
| `autobench/agent/validator.ts` | Create | W5 |
| `autobench/agent/prompts.ts` | Create | W6 |
| `autobench/agent/proposer.ts` | Create | W7 |
| `autobench/agent/proposer-rules.ts` | Create | W8 |
| `autobench/improver.ts` | Mark @deprecated | W8 |
| `autobench/cli/run.ts` | Modify — new flags | W10 |
| `autobench/package.json` | Modify — optional deps | W11 |
| `autobench/__tests__/promotion.test.ts` | Create | W2 |
| `autobench/__tests__/decisions.test.ts` | Create | W3 |
| `autobench/__tests__/llm-client.test.ts` | Create | W4 |
| `autobench/__tests__/validator.test.ts` | Create | W5 |
| `autobench/__tests__/prompts.test.ts` | Create | W6 |
| `autobench/__tests__/proposer.test.ts` | Create | W7 |
| `autobench/README.md` | Modify — add new docs | W13 |

**Do not create any file not listed above.**
**Execute work orders in numerical sequence — later orders depend on earlier ones.**
