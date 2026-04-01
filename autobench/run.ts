#!/usr/bin/env npx tsx

import type { BenchOptions } from './types.js';
import { runSkillPipeline, runAutoLearningLoop } from './runner.js';
import { generateDashboard } from './dashboard.js';

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs(args: string[]): { skill: string; options: BenchOptions } {
  let skill = 'sast-scan';
  const options: BenchOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skill': skill = args[++i] || 'sast-scan'; break;
      case '--limit': options.limit = parseInt(args[++i], 10); break;
      case '--fix': options.fix = true; break;
      case '--loop': options.loop = true; break;
      case '--iterations': options.iterations = parseInt(args[++i], 10); break;
      case '--dashboard': options.dashboard = true; break;
      case '--provider': options.provider = args[++i]; break;
      case '--model':    options.model    = args[++i]; break;
      case '--dry-run':  options.dryRun   = true;      break;
      case '--verbose': case '-v': options.verbose = true; break;
      case '--help': case '-h': showHelp(); process.exit(0);
    }
  }

  return { skill, options };
}

function showHelp() {
  console.log(`
AutoBench v0.1.0 — Security Skills Benchmarking

Usage:
  npx tsx run.ts [options]

Options:
  --skill <name>       Skill to test: sast-scan | secrets-scan | iac-scan (default: sast-scan)
  --limit <n>          Limit number of cases
  --fix                Show proposed fixes for findings
  --loop               Auto-learning loop
  --iterations <n>     Loop iterations (default: 100)
  --dashboard          Generate HTML dashboard
  --provider <name>    LLM provider: anthropic | openai (default: auto-detect from env)
  --model <name>       Override LLM model for the selected provider
  --dry-run            Print the LLM prompt without calling the API or modifying files
  --verbose, -v        Verbose output (show unmapped rules)
  --help, -h           Show this help

Flow (per skill):
  1. Load SKILL.md      → parse instructions
  2. Execute tool       → run semgrep/gitleaks/etc
  3. Review report      → apply skill's CWE mapping
  4. Propose fix        → suggest remediation
  5. Evaluate metrics   → P/R/F1 vs ground truth

Examples:
  npx tsx run.ts                              # Test sast-scan skill
  npx tsx run.ts --skill secrets-scan         # Test secrets-scan skill
  npx tsx run.ts --limit 5 --verbose          # Quick test with details
  npx tsx run.ts --fix                        # Show proposed fixes
  npx tsx run.ts --dashboard                  # Generate dashboard
`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const { skill, options } = parseArgs(process.argv.slice(2));

  try {
    if (options.dashboard) {
      generateDashboard();
      return;
    }

    if (options.loop) {
      await runAutoLearningLoop(skill, options);
    } else {
      await runSkillPipeline(skill, options);
    }
    generateDashboard();

  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    if (options.verbose) console.error(err.stack);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n❌ Unhandled error: ${err.message}`);
  process.exit(1);
});
