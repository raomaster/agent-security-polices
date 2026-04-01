// ─── Benchmark Definitions ───────────────────────────────────────────

export interface GroundTruthFinding {
  line: number;
  cwe: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface BenchmarkCase {
  id: string;
  file: string;
  language: string;
  cwe: string;
  vulnerable: boolean;
  findings: GroundTruthFinding[];
  note?: string;
}

export interface BenchmarkGroup {
  cwe: string;
  name: string;
  category: string;
  cases: BenchmarkCase[];
}

export interface BenchmarkManifest {
  version: string;
  generated: string;
  totalCases: number;
  groups: { cwe: string; name: string; caseCount: number; dir: string }[];
}

// ─── Scan Results ────────────────────────────────────────────────────

export interface ScanFinding {
  tool: 'semgrep' | 'gitleaks' | 'trivy' | 'kics';
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  cwe: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  ruleId: string;
  confidence?: number;
}

export interface ScanResult {
  tool: 'semgrep' | 'gitleaks' | 'trivy' | 'kics';
  findings: ScanFinding[];
  durationMs: number;
  exitCode: number;
  stderr?: string;
}

// ─── Evaluation Metrics ─────────────────────────────────────────────

export interface Metrics {
  cwe: string;
  tool: string;
  caseId: string;
  language: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  durationMs: number;
}

export interface AggregateMetrics {
  totalCases: number;
  totalTp: number;
  totalFp: number;
  totalFn: number;
  totalTn: number;
  precision: number;
  recall: number;
  f1: number;
  byCwe: Map<string, { precision: number; recall: number; f1: number; count: number }>;
  byTool: Map<string, { precision: number; recall: number; f1: number; count: number }>;
  /** Recall on CRITICAL+HIGH benchmark cases only. Populated by runner.ts after runBenchmarkOnce. */
  recallCritical?: number;
  /** FP rate on vulnerable:false fixture cases. Populated by runner.ts after runBenchmarkOnce. */
  fpRateSafe?: number;
}

export interface RunResult {
  runId: number;
  timestamp: string;
  aggregate: AggregateMetrics;
  metrics: Metrics[];
  durationMs: number;
}

// ─── Fix Proposals ──────────────────────────────────────────────────

export interface FixProposal {
  caseId: string;
  cwe: string;
  finding: ScanFinding;
  originalCode: string;
  proposedFix: string;
  explanation: string;
  provider: 'openai' | 'anthropic';
  model: string;
  tokensUsed: number;
}

export interface FixVerification {
  proposal: FixProposal;
  applied: boolean;
  resolved: boolean;
  newFindings: ScanFinding[];
  error?: string;
}

// ─── Auto-Learning ──────────────────────────────────────────────────

export interface Improvement {
  target: 'skill' | 'policy' | 'rules' | 'semgrepignore';
  file: string;
  description: string;
  diff: string;
}

export interface IterationResult {
  iteration: number;
  timestamp: string;
  improvement: Improvement | null;
  beforeMetrics: AggregateMetrics;
  afterMetrics: AggregateMetrics;
  status: 'keep' | 'discard' | 'crash';
  scoreDelta: number;
}

// ─── CLI Options ────────────────────────────────────────────────────

export interface BenchOptions {
  cwe?: string[];
  tool?: string[];
  limit?: number;
  fix?: boolean;
  provider?: string;
  model?: string;
  dryRun?: boolean;
  loop?: boolean;
  iterations?: number;
  dashboard?: boolean;
  verbose?: boolean;
}

// ─── Normalized Finding (canonical form, all adapters output this) ──

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

// ─── Proposal types ──────────────────────────────────────────────────

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

// ─── Promotion ───────────────────────────────────────────────────────

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

// ─── Aggregate Metrics Summary ───────────────────────────────────────

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

// ─── Experiment Record ───────────────────────────────────────────────

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

// ─── LLM types ───────────────────────────────────────────────────────

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

// ─── Anti-cycling ────────────────────────────────────────────────────

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

// ─── Dashboard Data ─────────────────────────────────────────────────

export interface DashboardData {
  generated: string;
  totalRuns: number;
  latestRun: RunResult | null;
  history: { runId: number; timestamp: string; f1: number; precision: number; recall: number }[];
  byCwe: { cwe: string; name: string; precision: number; recall: number; f1: number }[];
  byTool: { tool: string; precision: number; recall: number; f1: number; fpRate: number }[];
}
