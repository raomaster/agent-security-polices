import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BenchmarkGroup, BenchmarkCase, BenchmarkManifest, Metrics, AggregateMetrics, ScanFinding, BenchOptions, Proposal, ExperimentRecord } from './types.js';
import { parseSkillMd, type SkillDef } from './skill.js';
import { executeTool } from './executor.js';
import { generateFix, mapToRule, triageBySeverity, type FixResult } from './fixer.js';
import { aggregate, evaluate, compareScores, formatAggregateReport } from './evaluator.js';
import { initResultsTsv, logMetrics, logAggregate } from './results.js';
import { getCommitHash, getShortHash, commitChange, revertTo, isClean, createBranch } from './git.js';
import { generateProposal, type ProposalResult } from './agent/proposer.js';
import { generateProposalFromRules } from './agent/proposer-rules.js';
import { buildSystemPrompt, buildUserPrompt, type ProposerContext } from './agent/prompts.js';
import { evaluatePromotion, DEFAULT_PROMOTION_CONFIG } from './orchestration/promotion.js';
import { logExperiment, logTriedChange, loadTriedChanges } from './artifacts/decisions.js';
import { detectProvider, buildDefaultConfig } from './agent/llm-client.js';
import type { LlmProvider } from './types.js';

const BENCH_DIR = resolve(import.meta.dirname, '..', 'benchmarks');

// ─── Load Benchmarks ────────────────────────────────────────────────

function loadManifest(): BenchmarkManifest {
  return JSON.parse(readFileSync(resolve(BENCH_DIR, 'manifest.json'), 'utf-8'));
}

function loadGroup(dir: string): BenchmarkGroup {
  return JSON.parse(readFileSync(resolve(BENCH_DIR, dir, 'ground.json'), 'utf-8'));
}

// ─── Map skill name to benchmark CWE ────────────────────────────────

const SKILL_TO_CWE: Record<string, string[]> = {
  'sast-scan': ['CWE-079', 'CWE-089', 'CWE-078', 'CWE-327', 'CWE-502', 'CWE-022', 'CWE-287', 'CWE-862', 'CWE-330', 'CWE-532'],
  'secrets-scan': ['CWE-798', 'CWE-532'],
  'iac-scan': ['IaC-TF', 'IaC-K8S']
};

// ─── Mapped Finding (after applying sast-scan skill mapping) ────────

interface MappedFinding extends ScanFinding {
  skillCwe: string;
  skillRule: string;
  mapped: boolean;
}

/** Convert MappedFinding[] to ScanFinding[] using skillCwe for evaluation */
function remapForEval(findings: MappedFinding[]): ScanFinding[] {
  return findings.map(f => ({ ...f, cwe: f.skillCwe || f.cwe }));
}

function applySkillMapping(findings: ScanFinding[], skill: SkillDef): MappedFinding[] {
  return findings.map(f => {
    for (const m of skill.mappings) {
      if (m.regex.test(f.ruleId)) {
        return { ...f, skillCwe: m.cwe, skillRule: m.rule, mapped: true };
      }
    }
    return { ...f, skillCwe: f.cwe, skillRule: '', mapped: false };
  });
}

// ─── Main: Run Skill Pipeline ───────────────────────────────────────

export async function runSkillPipeline(skillName: string, options: BenchOptions): Promise<AggregateMetrics> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AutoBench: Testing skill "${skillName}"`);
  console.log(`${'═'.repeat(60)}\n`);

  // Step 1: Load scan SKILL.md (sast-scan, secrets-scan, etc)
  const skill = parseSkillMd(skillName);
  console.log(`  📄 Loaded: ${skill.source}`);
  console.log(`  🔧 Tool: ${skill.tool}`);
  console.log(`  📊 Mappings: ${skill.mappings.length} CWE rules`);

  // Also load fix-findings skill (used in step 4)
  console.log(`  🔧 Fix skill: fix-findings (CWE → AGENT_RULES.md)\n`);

  const cweFilter = SKILL_TO_CWE[skillName] || [];
  const manifest = loadManifest();
  const allMetrics: Metrics[] = [];
  const allFixes: FixResult[] = [];
  let caseCount = 0;
  initResultsTsv();

  for (const groupInfo of manifest.groups) {
    if (cweFilter.length > 0 && !cweFilter.includes(groupInfo.cwe)) continue;

    const group = loadGroup(groupInfo.dir.replace('benchmarks/', ''));
    console.log(`\n  ━━ ${group.cwe}: ${group.name} (${group.cases.length} cases) ━━`);

    for (const benchCase of group.cases) {
      if (options.limit && caseCount >= options.limit) break;

      const caseDir = resolve(BENCH_DIR, groupInfo.dir.replace('benchmarks/', ''));

      // Step 2: Execute tool (following scan skill instructions)
      process.stdout.write(`    ${benchCase.id}... `);
      const t0 = Date.now();
      const rawFindings = executeTool(skill, caseDir, benchCase.file);
      const duration = Date.now() - t0;

      // Step 3: Review report (apply scan skill's CWE mapping)
      const mapped = applySkillMapping(rawFindings, skill);

      // Step 4: Propose fix (using fix-findings skill)
      //   - Triage by severity (CRITICAL → HIGH → MEDIUM → LOW)
      //   - Map each finding to AGENT_RULES.md rule
      //   - Generate fix in fix-findings output format
      let caseFixes: FixResult[] = [];
      if (options.fix && mapped.length > 0 && benchCase.vulnerable) {
        const triaged = triageBySeverity(mapped);
        caseFixes = triaged.map(f => generateFix(f));
        allFixes.push(...caseFixes);
      }

      // Step 5: Evaluate metrics
      const metrics = evaluate(benchCase, remapForEval(mapped), 'skill-pipeline', duration);
      allMetrics.push(metrics);
      caseCount++;
      logMetrics(Date.now(), metrics, 'baseline', '');

      // Display result
      const icon = benchCase.vulnerable
        ? (metrics.tp > 0 ? '✅' : '❌')
        : (metrics.fp > 0 ? '⚠️' : '✅');
      const mappedCount = mapped.filter(m => m.mapped).length;
      console.log(`${icon} P:${metrics.precision} R:${metrics.recall} F1:${metrics.f1} (${duration}ms) [${mappedCount}/${mapped.length} mapped]`);

      // Show unmapped findings (gaps in sast-scan skill mapping)
      const unmapped = mapped.filter(m => !m.mapped && m.cwe !== 'UNKNOWN');
      if (unmapped.length > 0 && options.verbose) {
        for (const u of unmapped) {
          console.log(`      ⚠ Unmapped: ${u.ruleId} → ${u.cwe} (add to sast-scan SKILL.md)`);
        }
      }

      // Show fix proposals (from fix-findings skill)
      if (caseFixes.length > 0) {
        for (const fix of caseFixes) {
          console.log(`      🔧 [${fix.severity}] ${fix.rule}`);
          console.log(`         ${fix.fixCode}`);
        }
      }
    }
  }

  // ─── Aggregate Report ─────────────────────────────────────────
  const agg = aggregate(allMetrics);
  console.log('\n' + formatAggregateReport(agg));
  logAggregate(Date.now(), agg, 'baseline', `skill:${skillName}`);

  // ─── Fix Summary (fix-findings output format) ─────────────────
  if (allFixes.length > 0) {
    console.log('\n  📋 Fix Summary (fix-findings format):');
    console.log(`     Total findings: ${allFixes.length}`);

    const bySeverity = new Map<string, number>();
    for (const f of allFixes) {
      bySeverity.set(f.severity, (bySeverity.get(f.severity) || 0) + 1);
    }
    for (const [sev, count] of bySeverity) {
      console.log(`     ${sev}: ${count}`);
    }

    const withRule = allFixes.filter(f => f.rule !== 'No mapping found');
    console.log(`     Mapped to AGENT_RULES.md: ${withRule.length}/${allFixes.length}`);
  }

  // ─── Improvement Opportunities ────────────────────────────────
  console.log('\n  📋 Improvement Opportunities:');
  const fnCwes = [...new Set(allMetrics.filter(m => m.fn > 0).map(m => m.cwe))];
  if (fnCwes.length > 0) {
    console.log(`    - False Negatives (missed): ${fnCwes.join(', ')}`);
    console.log('      → Add semgrep rules or mappings to sast-scan SKILL.md');
  }

  const fpCases = allMetrics.filter(m => m.fp > 0);
  if (fpCases.length > 0) {
    console.log(`    - False Positives (noise): ${fpCases.map(m => m.caseId).join(', ')}`);
    console.log('      → Add exclusion patterns to sast-scan SKILL.md');
  }

  // Show which rules aren't in fix-findings mapping
  const unmappedRules = allFixes.filter(f => f.rule === 'No mapping found');
  if (unmappedRules.length > 0) {
    const uniqueCwes = [...new Set(unmappedRules.map(f => f.finding.cwe))];
    console.log(`    - Unmapped in fix-findings: ${uniqueCwes.join(', ')}`);
    console.log('      → Add CWE→Rule mapping to fix-findings SKILL.md');
  }

  return agg;
}

// ─── Run benchmarks once and return metrics + unmapped findings ─────

interface BenchmarkResult {
  metrics: Metrics[];
  aggregate: AggregateMetrics;
  unmapped: { ruleId: string; cwe: string; caseId: string; expectedCwe?: string }[];
  falsePositives: { caseId: string; cwe: string }[];
  falseNegatives: { caseId: string; cwe: string }[];
  recallCritical: number;   // recall on cases with CRITICAL or HIGH ground truth findings
  fpRateSafe: number;       // FP rate on vulnerable:false cases
}

async function runBenchmarkOnce(skillName: string, options: BenchOptions): Promise<BenchmarkResult> {
  const skill = parseSkillMd(skillName);
  const cweFilter = SKILL_TO_CWE[skillName] || [];
  const manifest = loadManifest();
  const allMetrics: Metrics[] = [];
  const unmapped: { ruleId: string; cwe: string; caseId: string; expectedCwe?: string }[] = [];
  const falsePositives: { caseId: string; cwe: string }[] = [];
  const falseNegatives: { caseId: string; cwe: string }[] = [];
  // Protected metrics accumulators
  let criticalTp = 0, criticalFn = 0;
  let safeCases = 0, safeFpCases = 0;
  let caseCount = 0;

  for (const groupInfo of manifest.groups) {
    if (cweFilter.length > 0 && !cweFilter.includes(groupInfo.cwe)) continue;
    const group = loadGroup(groupInfo.dir.replace('benchmarks/', ''));

    for (const benchCase of group.cases) {
      if (options.limit && caseCount >= options.limit) break;
      const caseDir = resolve(BENCH_DIR, groupInfo.dir.replace('benchmarks/', ''));
      const rawFindings = executeTool(skill, caseDir, benchCase.file);
      const mapped = applySkillMapping(rawFindings, skill);
      const metrics = evaluate(benchCase, remapForEval(mapped), 'skill-pipeline', 0);
      allMetrics.push(metrics);
      caseCount++;

      // Collect unmapped findings (with expected CWE for prioritization)
      for (const f of mapped) {
        if (!f.mapped && f.cwe !== 'UNKNOWN') {
          unmapped.push({ ruleId: f.ruleId, cwe: f.cwe, caseId: benchCase.id, expectedCwe: benchCase.cwe });
        }
      }

      // Collect FPs and FNs
      if (metrics.fp > 0) falsePositives.push({ caseId: benchCase.id, cwe: metrics.cwe });
      if (metrics.fn > 0) falseNegatives.push({ caseId: benchCase.id, cwe: metrics.cwe });

      // Protected metric: recallCritical — cases with CRITICAL or HIGH ground truth findings
      if (benchCase.vulnerable && benchCase.findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
        criticalTp += metrics.tp;
        criticalFn += metrics.fn;
      }

      // Protected metric: fpRateSafe — rate of cases flagged among safe (non-vulnerable) cases
      if (!benchCase.vulnerable) {
        safeCases++;
        if (metrics.fp > 0) safeFpCases++;
      }
    }
  }

  const recallCritical = criticalTp + criticalFn > 0
    ? criticalTp / (criticalTp + criticalFn)
    : 1;  // no critical cases in filter → no regression possible
  const fpRateSafe = safeCases > 0 ? safeFpCases / safeCases : 0;

  return {
    metrics: allMetrics,
    aggregate: aggregate(allMetrics),
    unmapped,
    falsePositives,
    falseNegatives,
    recallCritical,
    fpRateSafe,
  };
}

// ─── Helper: summarize AggregateMetrics to flat object for logging ───

function toMetricsSummary(result: BenchmarkResult) {
  const agg = result.aggregate;
  return {
    f1: agg.f1,
    precision: agg.precision,
    recall: agg.recall,
    recallCritical: result.recallCritical,
    fpRateSafe: result.fpRateSafe,
    totalCases: agg.totalCases,
    totalTp: agg.totalTp,
    totalFp: agg.totalFp,
    totalFn: agg.totalFn,
  };
}

// ─── Auto-Learning Loop ──────────────────────────────────────────────

export async function runAutoLearningLoop(skillName: string, options: BenchOptions): Promise<void> {
  const iterations = options.iterations || 100;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AutoBench: Auto-Learning Loop`);
  console.log(`  Skill: ${skillName} | Iterations: ${iterations}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ── Dry run: print prompt and exit — no branch, no file changes ──
  if (options.dryRun) {
    // Validate SKILL.md is parseable before spending time on benchmarks
    try {
      parseSkillMd(skillName);
    } catch (err: any) {
      console.error(`  ✗ Dry-run aborted: ${err.message}`);
      return;
    }

    // Validate benchmark directory exists
    const benchDir = resolve(import.meta.dirname, '..', 'benchmarks');
    if (!existsSync(resolve(benchDir, 'manifest.json'))) {
      console.error(`  ✗ Dry-run aborted: benchmarks/manifest.json not found`);
      return;
    }

    const dryBaseline = await runBenchmarkOnce(skillName, options);
    const dryContext: ProposerContext = {
      iteration: 1,
      skillName,
      skillContent: readFileSync(resolve(import.meta.dirname, '..', 'skills', skillName, 'SKILL.md'), 'utf-8'),
      aggregate: dryBaseline.aggregate,
      metrics: dryBaseline.metrics,
      unmapped: dryBaseline.unmapped.map(u => ({ ruleId: u.ruleId, cweFromTool: u.cwe, expectedCwe: u.expectedCwe || u.cwe, caseId: u.caseId })),
      falsePositives: dryBaseline.falsePositives.map(fp => ({ caseId: fp.caseId, cwe: fp.cwe, file: fp.caseId, language: '' })),
      falseNegatives: dryBaseline.falseNegatives.map(fn => ({ caseId: fn.caseId, cwe: fn.cwe, file: fn.caseId, language: '' })),
      triedChanges: loadTriedChanges(),
    };
    console.log('\n  ── DRY RUN: system prompt ───────────────────────');
    console.log(buildSystemPrompt());
    console.log('\n  ── DRY RUN: user prompt ─────────────────────────');
    console.log(buildUserPrompt(dryContext));
    console.log('  ─────────────────────────────────────────────────\n');
    return;
  }

  // ── Ensure clean working tree ──
  if (!isClean()) {
    console.log('  ⚠ Working tree not clean. Commit or stash changes first.');
    return;
  }

  // ── Branch isolation ──
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `autobench/run-${ts}`;
  createBranch(branchName);
  console.log(`  Branch: ${branchName}`);

  // ── Agent config (W9.3) ──
  const agentConfig = options.provider
    ? buildDefaultConfig(options.provider as LlmProvider, options.model)
    : (detectProvider() ?? null);

  const usingLlm = agentConfig !== null;
  if (!usingLlm) {
    console.log('  No API key detected — using rule-based proposer (set ANTHROPIC_API_KEY for LLM mode)');
  } else {
    console.log(`  LLM provider: ${agentConfig.provider} (${agentConfig.model})`);
  }

  // ── SIGINT handler (W9.8) ──
  let interrupted = false;
  process.once('SIGINT', () => {
    if (interrupted) process.exit(1);
    interrupted = true;
    console.log('\n  Interrupted. Finishing current iteration before stopping...');
  });

  initResultsTsv();
  let runId = 0;

  // ── Iteration 0: Baseline ──
  console.log('\n━━━ Iteration 0: Baseline ━━━\n');
  let baseline = await runBenchmarkOnce(skillName, options);
  let bestF1 = baseline.aggregate.f1;
  let bestHash = getCommitHash();
  let keepCount = 0;
  let discardCount = 0;

  console.log(`  Baseline F1: ${bestF1}\n`);
  logAggregate(runId, baseline.aggregate, 'baseline', 'iter-0');
  runId++;

  // ── Loop ──
  for (let i = 1; i <= iterations; i++) {
    if (interrupted) {
      console.log(`  Stopped at iteration ${i - 1}.`);
      break;
    }

    console.log(`\n━━━ Iteration ${i}/${iterations} ━━━\n`);
    const iterStart = Date.now();

    // ── Build proposer context (W9.4) ──
    const triedChanges = loadTriedChanges();
    const skillPath = resolve(import.meta.dirname, '..', 'skills', skillName, 'SKILL.md');
    const skillContent = readFileSync(skillPath, 'utf-8');

    const context: ProposerContext = {
      iteration: i,
      skillName,
      skillContent,
      aggregate: baseline.aggregate,
      metrics: baseline.metrics,
      unmapped: baseline.unmapped.map(u => ({
        ruleId: u.ruleId,
        cweFromTool: u.cwe,
        expectedCwe: u.expectedCwe || u.cwe,
        caseId: u.caseId,
      })),
      falsePositives: baseline.falsePositives.map(fp => ({
        caseId: fp.caseId,
        cwe: fp.cwe,
        file: fp.caseId,
        language: '',
      })),
      falseNegatives: baseline.falseNegatives.map(fn => ({
        caseId: fn.caseId,
        cwe: fn.cwe,
        file: fn.caseId,
        language: '',
      })),
      triedChanges,
    };

    // ── Generate proposal ──
    let proposal: Proposal | null = null;
    let llmTokensUsed = 0;
    try {
      if (usingLlm) {
        const result: ProposalResult = await generateProposal(context, agentConfig!);
        proposal = result.proposal;
        llmTokensUsed = result.tokensUsed;
      } else {
        proposal = generateProposalFromRules(context);
      }
    } catch (err: any) {
      console.warn(`  ⚠ Proposer error: ${err.message}`);
    }

    if (!proposal || proposal.confidence === 0) {
      console.log('  No further proposals. Loop complete.');
      break;
    }

    console.log(`  Proposal: [${proposal.type}] ${proposal.hypothesis}`);
    console.log(`  File: ${proposal.file}`);
    console.log(`  Find: ${proposal.find.substring(0, 60)}...`);
    console.log(`  Replace: ${proposal.replace.substring(0, 60)}...`);

    // ── Apply via find/replace ──
    const filePath = resolve(import.meta.dirname, '..', proposal.file);
    let beforeContent: string;
    try {
      beforeContent = readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      console.warn(`  ⚠ Cannot read ${proposal.file}: ${err.message}`);
      logTriedChange({
        iteration: i, timestamp: new Date().toISOString(),
        hypothesis: proposal.hypothesis, file: proposal.file,
        find: proposal.find, replace: proposal.replace,
        outcome: 'failed_to_apply', f1Delta: 0, generator: proposal.generator,
      });
      continue;
    }
    const afterContent = beforeContent.replace(proposal.find, proposal.replace);

    if (afterContent === beforeContent) {
      console.log('  ⚠ Find string not found in file — skipping iteration.');
      logTriedChange({
        iteration: i, timestamp: new Date().toISOString(),
        hypothesis: proposal.hypothesis, file: proposal.file,
        find: proposal.find, replace: proposal.replace,
        outcome: 'failed_to_apply', f1Delta: 0, generator: proposal.generator,
      });
      continue;
    }

    writeFileSync(filePath, afterContent, 'utf-8');

    // ── Git commit ──
    const commitMsg = proposal.hypothesis.substring(0, 60);
    const hash = commitChange(proposal.file, commitMsg, i);
    console.log(`  Committed: ${hash}`);

    // ── Re-run benchmarks ──
    console.log('  Re-running benchmarks...');
    const result = await runBenchmarkOnce(skillName, options);

    // ── Promotion decision ──
    const beforeAgg = Object.assign({}, baseline.aggregate, {
      recallCritical: baseline.recallCritical,
      fpRateSafe: baseline.fpRateSafe,
    });
    const afterAgg = Object.assign({}, result.aggregate, {
      recallCritical: result.recallCritical,
      fpRateSafe: result.fpRateSafe,
    });
    const decision = evaluatePromotion(beforeAgg, afterAgg);

    if (decision.outcome === 'promote') {
      baseline = result;  // W0.1: refresh baseline
      bestF1 = result.aggregate.f1;
      bestHash = getCommitHash();
      keepCount++;
      console.log(`  KEEP: F1 ${toFixed(decision.f1Delta)} | ${decision.reasons.join(', ') || 'all guards passed'}`);
      logAggregate(runId, result.aggregate, 'keep', `iter-${i}`);
    } else {
      discardCount++;
      console.log(`  REVERT: ${decision.reasons.join(', ')}`);
      revertTo(bestHash);
      logAggregate(runId, result.aggregate, 'revert', `iter-${i}`);
    }

    // ── Log per-iteration metrics ──
    for (const m of result.metrics) {
      logMetrics(runId, m, decision.outcome === 'promote' ? 'keep' : 'revert', `iter-${i}`);
    }
    runId++;

    // ── Log experiment record (W9.7) ──
    const record: ExperimentRecord = {
      experimentId: randomUUID(),
      parentBaselineId: bestHash,
      iteration: i,
      timestamp: new Date().toISOString(),
      skillName,
      proposal,
      beforeMetrics: toMetricsSummary(baseline),
      afterMetrics: toMetricsSummary(result),
      decision,
      durationMs: Date.now() - iterStart,
      llmTokensUsed,
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
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Loop Complete`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total iterations: ${iterations}`);
  console.log(`  Kept (improved):  ${keepCount}`);
  console.log(`  Reverted:         ${discardCount}`);
  console.log(`  Best F1:          ${bestF1}`);
  console.log(`  Branch:           ${branchName}`);
  console.log(`\n  Results: results/results.tsv`);
  console.log(`  Experiments: results/decisions.jsonl`);
  console.log(`  Dashboard: npx tsx run.ts --dashboard`);
}

function toFixed(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(3);
}
