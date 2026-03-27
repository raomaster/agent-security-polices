import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BenchmarkGroup, BenchmarkCase, BenchmarkManifest, Metrics, AggregateMetrics, ScanFinding, BenchOptions } from './types.js';
import { parseSkillMd, type SkillDef } from './skill.js';
import { executeTool } from './executor.js';
import { generateFix, mapToRule, triageBySeverity, type FixResult } from './fixer.js';
import { aggregate, compareScores, formatAggregateReport } from './evaluator.js';
import { initResultsTsv, logMetrics, logAggregate } from './results.js';
import { getCommitHash, getShortHash, commitChange, revertTo, isClean } from './git.js';
import { proposeImprovements, applyImprovement, resetTriedChanges, type Improvement } from './improver.js';

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
  'sast-scan': ['CWE-079', 'CWE-089', 'CWE-078', 'CWE-327', 'CWE-502', 'CWE-022', 'CWE-287', 'CWE-862'],
  'secrets-scan': ['CWE-798', 'CWE-532'],
  'iac-scan': ['IaC-TF', 'IaC-K8S']
};

// ─── Mapped Finding (after applying sast-scan skill mapping) ────────

interface MappedFinding extends ScanFinding {
  skillCwe: string;
  skillRule: string;
  mapped: boolean;
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

// ─── Evaluate (compare findings vs ground truth) ────────────────────

function evaluateCase(benchCase: BenchmarkCase, findings: MappedFinding[]): Metrics {
  let tp = 0, fn = 0, fp = 0;
  const matched = new Set<number>();

  if (benchCase.vulnerable) {
    for (const expected of benchCase.findings) {
      const idx = findings.findIndex((f, i) =>
        !matched.has(i) &&
        f.skillCwe === expected.cwe.padStart(7, '0') &&
        Math.abs(f.line - expected.line) <= 2
      );
      if (idx >= 0) { tp++; matched.add(idx); } else { fn++; }
    }
    fp = findings.length - matched.size;
  } else {
    fp = findings.length;
  }

  const p = tp + fp > 0 ? tp / (tp + fp) : (tp > 0 ? 1 : 0);
  const r = tp + fn > 0 ? tp / (tp + fn) : (tp > 0 ? 1 : 0);
  const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;
  const round = (n: number) => Math.round(n * 1000) / 1000;

  return {
    cwe: benchCase.cwe,
    tool: 'skill-pipeline',
    caseId: benchCase.id,
    language: benchCase.language,
    tp, fp, fn, tn: 0,
    precision: round(p), recall: round(r), f1: round(f1),
    durationMs: 0
  };
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
      const metrics = evaluateCase(benchCase, mapped);
      metrics.durationMs = duration;
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

  const unmappedFindings = allMetrics.filter(m => m.caseId && false); // placeholder
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
}

async function runBenchmarkOnce(skillName: string, options: BenchOptions): Promise<BenchmarkResult> {
  const skill = parseSkillMd(skillName);
  const cweFilter = SKILL_TO_CWE[skillName] || [];
  const manifest = loadManifest();
  const allMetrics: Metrics[] = [];
  const unmapped: { ruleId: string; cwe: string; caseId: string; expectedCwe?: string }[] = [];
  const falsePositives: { caseId: string; cwe: string }[] = [];
  const falseNegatives: { caseId: string; cwe: string }[] = [];
  let caseCount = 0;

  for (const groupInfo of manifest.groups) {
    if (cweFilter.length > 0 && !cweFilter.includes(groupInfo.cwe)) continue;
    const group = loadGroup(groupInfo.dir.replace('benchmarks/', ''));

    for (const benchCase of group.cases) {
      if (options.limit && caseCount >= options.limit) break;
      const caseDir = resolve(BENCH_DIR, groupInfo.dir.replace('benchmarks/', ''));
      const rawFindings = executeTool(skill, caseDir, benchCase.file);
      const mapped = applySkillMapping(rawFindings, skill);
      const metrics = evaluateCase(benchCase, mapped);
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
    }
  }

  return { metrics: allMetrics, aggregate: aggregate(allMetrics), unmapped, falsePositives, falseNegatives };
}

// ─── Auto-Learning Loop (like autoresearch) ─────────────────────────

export async function runAutoLearningLoop(skillName: string, options: BenchOptions): Promise<void> {
  const iterations = options.iterations || 100;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AutoBench: Auto-Learning Loop`);
  console.log(`  Skill: ${skillName} | Iterations: ${iterations}`);
  console.log(`${'═'.repeat(60)}\n`);

  initResultsTsv();
  resetTriedChanges(); // Clear previous improvement attempts

  // Ensure clean working tree
  if (!isClean()) {
    console.log('  ⚠ Working tree not clean. Committing or stashing changes first...');
    return;
  }

  // ── Iteration 0: Baseline ──
  console.log('━━━ Iteration 0: Baseline ━━━\n');
  const baseline = await runBenchmarkOnce(skillName, options);
  let bestF1 = baseline.aggregate.f1;
  let bestHash = getCommitHash();
  let keepCount = 0;
  let discardCount = 0;

  console.log(`  Baseline F1: ${bestF1}\n`);
  logAggregate(Date.now(), baseline.aggregate, 'baseline', `iter-0`);

  // ── Loop ──
  for (let i = 1; i <= iterations; i++) {
    console.log(`\n━━━ Iteration ${i}/${iterations} ━━━\n`);

    // 1. Analyze current metrics + unmapped findings → propose improvements
    const improvements = proposeImprovements(baseline.metrics, {
      unmapped: baseline.unmapped,
      falsePositives: baseline.falsePositives,
      falseNegatives: baseline.falseNegatives
    });

    if (improvements.length === 0) {
      console.log('  🎉 No improvements to try. Loop complete.');
      break;
    }

    // 2. Apply the first improvement
    const improvement = improvements[0];
    console.log(`  📝 Proposing: ${improvement.description}`);
    console.log(`     File: ${improvement.file}`);
    console.log(`     Change: ${improvement.change.substring(0, 80)}...`);

    const applied = applyImprovement(improvement);
    if (!applied) {
      console.log('  ❌ Failed to apply. Skipping.');
      continue;
    }

    // 3. Git commit
    const hash = commitChange(improvement.file, improvement.description, i);
    console.log(`  📦 Committed: ${hash}`);

    // 4. Re-run benchmarks
    console.log('  🔄 Re-running benchmarks...');
    const result = await runBenchmarkOnce(skillName, options);

    // 5. Compare scores
    const comparison = compareScores(baseline.aggregate, result.aggregate);

    // 6. Keep or Revert
    if (comparison.improved) {
      // ✅ KEEP — score improved
      bestF1 = result.aggregate.f1;
      bestHash = getCommitHash();
      keepCount++;
      console.log(`  ✅ KEEP: F1 ${baseline.aggregate.f1} → ${result.aggregate.f1} (Δ ${comparison.f1Delta})`);
      console.log(`     Precision: ${baseline.aggregate.precision} → ${result.aggregate.precision}`);
      console.log(`     Recall: ${baseline.aggregate.recall} → ${result.aggregate.recall}`);
      logAggregate(Date.now(), result.aggregate, 'keep', `iter-${i} improved`);
    } else {
      // ❌ REVERT — score didn't improve (or got worse)
      discardCount++;
      console.log(`  ❌ REVERT: F1 ${baseline.aggregate.f1} → ${result.aggregate.f1} (Δ ${comparison.f1Delta})`);
      console.log(`     Reverting to ${getShortHash()}...`);
      revertTo(bestHash);
      console.log(`     Reverted. Best F1 remains: ${bestF1}`);
      logAggregate(Date.now(), result.aggregate, 'revert', `iter-${i} no improvement`);
    }

    // Log per-iteration metrics to TSV
    for (const m of result.metrics) {
      logMetrics(Date.now(), m, comparison.improved ? 'keep' : 'revert', `iter-${i}`);
    }
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Loop Complete`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total iterations: ${iterations}`);
  console.log(`  Kept (improved):  ${keepCount}`);
  console.log(`  Reverted:         ${discardCount}`);
  console.log(`  Best F1:          ${bestF1}`);
  console.log(`  Best commit:      ${getShortHash()}`);
  console.log(`\n  Results: results/results.tsv`);
  console.log(`  Dashboard: npx tsx run.ts --dashboard`);
}
