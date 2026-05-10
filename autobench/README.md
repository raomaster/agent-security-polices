# AutoBench: Continuous Security Skill Refinement

> An autonomous benchmarking and self-improvement framework for AI security agent skills, inspired by [autoresearch](https://github.com/karpathy/autoresearch) by Andrej Karpathy.

---

## Quickstart

```bash
# 1. Setup (once)
cd autobench
npm install

# 2. Test sast-scan skill (single pass)
npx tsx run.ts

# 3. Quick smoke test (5 cases)
npx tsx run.ts --limit 5 --verbose

# 4. Test secrets-scan skill
npx tsx run.ts --skill secrets-scan

# 5. Show fix proposals (using fix-findings)
npx tsx run.ts --fix

# 6. Auto-learning loop (100 iterations, ~2h)
npx tsx run.ts --loop

# 7. Overnight run (200 iterations)
npx tsx run.ts --loop --iterations 200 --verbose

# 8. Generate HTML dashboard
npx tsx run.ts --dashboard
```

### All Commands

| Command | Description |
|---------|-------------|
| `npx tsx run.ts` | Full benchmark on sast-scan (default) |
| `npx tsx run.ts --skill secrets-scan` | Benchmark secrets-scan skill |
| `npx tsx run.ts --skill iac-scan` | Benchmark IaC scanning skill |
| `npx tsx run.ts --limit 5` | Test only 5 cases (quick validation) |
| `npx tsx run.ts --verbose` | Show unmapped rules and gaps |
| `npx tsx run.ts --fix` | Show fix proposals from fix-findings |
| `npx tsx run.ts --loop` | Auto-learning loop — rule-based proposer (no API key needed) |
| `npx tsx run.ts --loop --iterations 50` | Custom iteration count |
| `ANTHROPIC_API_KEY=... npx tsx run.ts --loop` | Loop with LLM proposer (Anthropic) |
| `OPENAI_API_KEY=... npx tsx run.ts --loop` | Loop with LLM proposer (OpenAI) |
| `npx tsx run.ts --loop --provider anthropic --model claude-opus-4-20250514` | Override provider and model |
| `npx tsx run.ts --loop --dry-run` | Print LLM prompt without calling API or modifying files |
| `npx tsx run.ts --dashboard` | Generate HTML dashboard from results |

### Prerequisites

- **Node.js** ≥18
- **Docker** (for Semgrep/Gitleaks) or local tool installation

---

## The Problem

Security scanning tools (Semgrep, Gitleaks, Trivy, KICS) produce raw findings. But the value of an AI security agent lies in the **skill layer** — the instructions, CWE mappings, severity rules, and false-positive exclusions defined in `SKILL.md` files.

How do you know if your skills are accurate? How do you improve them systematically?

**AutoBench answers both questions.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AutoBench Pipeline                           │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ 1. Load  │──▶│ 2. Scan  │──▶│ 3. Map   │──▶│ 4. Fix     │  │
│  │ SKILL.md │   │ semgrep/ │   │ CWE via  │   │ fix-findings│  │
│  │          │   │ gitleaks │   │ skill    │   │ AGENT_RULES │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────┬──────┘  │
│                                                      │         │
│                                                      ▼         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐   │
│  │ 7. Keep  │◀──│ 6. Score │◀──│ 5. Evaluate              │   │
│  │ or Revert│   │ F1 delta │   │ TP/FP/FN vs ground truth │   │
│  │ (git)    │   │          │   │                          │   │
│  └──────────┘   └──────────┘   └──────────────────────────┘   │
│       │                                                       │
│       ▼                                                       │
│  results.tsv  ◀────  metrics per iteration                    │
│  dashboard/   ◀────  HTML visualization                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Auto-Learning Loop

Like autoresearch trains a model by iterating on code, AutoBench iterates on **skill instructions**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   benchmarks/ ──▶ scan ──▶ evaluate ──▶ identify gaps       │
│        ▲                                      │             │
│        │                                      ▼             │
│        └──── commit ◀── improve ◀── analyze patterns        │
│               (if F1 ↑)      (edit SKILL.md)                │
│        │                                                    │
│        └──── revert ◀── discard ◀── (if F1 ≤)              │
│                                                             │
│   Metric: F1 score (harmonic mean of precision & recall)    │
│   Budget: ~100 iterations overnight                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

```
Iteration N:
  1. Run benchmarks → get F1 = 0.750
  2. Analyze: CWE-330 not detected (FN), xss-004 flagged as safe (FP)
  3. Propose: Add `*.random.insecure*` → CWE-330 mapping to sast-scan SKILL.md
  4. git commit: "[autobench] iter 12: add CWE-330 mapping"
  5. Re-run benchmarks → get F1 = 0.812
  6. F1 improved (+0.062) → ✅ KEEP commit

Iteration N+1:
  1. Run benchmarks → get F1 = 0.812
  2. Analyze: xss-004 still flagged (FP on DOMPurify code)
  3. Propose: Add exclusion for `*safe*` files to sast-scan SKILL.md
  4. git commit: "[autobench] iter 13: add safe-file exclusion"
  5. Re-run benchmarks → get F1 = 0.798
  6. F1 decreased (-0.014) → ❌ REVERT (git reset --hard HEAD~1)
```

### Proposer: LLM mode vs Rule-based fallback

The loop uses two proposal generators depending on whether an API key is configured:

| Mode | When active | How it proposes |
|------|-------------|-----------------|
| **LLM proposer** | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set | Calls the model with full context (metrics, unmapped findings, tried history). Generates unbounded, context-aware hypotheses. |
| **Rule-based fallback** | No API key | Static lookup: maps unmapped ruleIds and FN CWEs to known Semgrep patterns. Limited to ~11 CWE entries, exhausts in one session. |

In both modes, the evaluation is always deterministic: the LLM (or rules engine) proposes, the benchmark evaluator decides. The LLM never determines whether a change is kept.

### Promotion guards

A change is kept only if ALL of these pass:

| Guard | Condition |
|-------|-----------|
| `delta_f1` | `after.f1 - before.f1 > 0.001` |
| `critical_recall` | Recall on HIGH+CRITICAL cases must not regress |
| `safe_fp_rate` | FP rate on `vulnerable:false` fixtures must not increase |
| `schema_valid` | SKILL.md remains parseable after change |
| `no_crash` | Scan adapter must not crash |

### Monitoring a running loop

```bash
# Watch experiment decisions in real time
tail -f results/decisions.jsonl | while IFS= read -r line; do
  echo "$line" | python3 -m json.tool | grep -E 'outcome|f1Delta|hypothesis'
done

# Quick summary of all tried changes
cat results/tried_changes.jsonl | jq -r '[.outcome, .f1Delta, .hypothesis] | @tsv'

# Count keeps vs reverts
cat results/tried_changes.jsonl | jq -s 'group_by(.outcome) | map({outcome: .[0].outcome, count: length})'

# Check which branch the loop is running on
git branch --list 'autobench/run-*'
```

---

## Git workflow

The project follows a standard Git Flow:

```
main          ← stable releases only
develop       ← integration branch
feature/*     ← active development (e.g. feature/autobench)
autobench/run-* ← experiment branches created by the loop
```

### How the loop uses branches

When you run `--loop`, the runner automatically creates an experiment branch from wherever you are:

```
feature/autobench
│
└── autobench/run-2026-03-28T11-00-00   ← created at loop start
    ├── [autobench] iter 1: add *.random.insecure* → CWE-330   ← KEPT
    ├── [autobench] iter 3: add *.xss.* → CWE-079              ← KEPT
    │   (iter 2 was reverted — git reset --hard, commit erased)
    └── ...
```

Each kept improvement is a real commit. Each reverted change is erased from history with `git reset --hard`. You end the session on the experiment branch with only the validated improvements in the log.

### After a loop session

```bash
# 1. Review what the loop kept
git log autobench/run-2026-03-28T11-00-00 --oneline

# 2. Review which skill files changed
git diff feature/autobench...autobench/run-2026-03-28T11-00-00 -- skills/

# 3. If the improvements look good — merge into your feature branch
git checkout feature/autobench
git merge autobench/run-2026-03-28T11-00-00

# 4. Clean up the experiment branch
git branch -d autobench/run-2026-03-28T11-00-00

# 5. When ready to integrate with the team
git checkout develop
git merge feature/autobench
```

The loop never touches `develop` or `main` directly. All experiments are isolated to `autobench/run-*` branches until you explicitly merge them.

---

## What Gets Improved

| Target File | What Changes | Example |
|-------------|-------------|---------|
| `skills/sast-scan/SKILL.md` | CWE mapping table, severity rules, exclusions | Add `*.random.insecure*` → CWE-330 |
| `skills/secrets-scan/SKILL.md` | Secret type patterns, exclusion rules | Add gitleaks custom rule |
| `skills/fix-findings/SKILL.md` | CWE → AGENT_RULES.md mapping | Add CWE-330 → Rule 6 |
| `policies/*.yaml` | Severity levels, prevention rules | Adjust CWE-330 severity |

**What is never modified:**
- `benchmarks/` — ground truth is immutable
- `src/` — CLI code
- `autobench/` — the tool itself

---

## Metrics

AutoBench measures the complete skill pipeline end-to-end:

| Metric | Formula | What It Measures |
|--------|---------|------------------|
| **Precision** | TP / (TP + FP) | % of findings that are real vulnerabilities |
| **Recall** | TP / (TP + FN) | % of real vulnerabilities that were found |
| **F1 Score** | 2×P×R / (P+R) | Combined accuracy (primary metric) |
| **Fix Rate** | Verified / Proposed | % of fixes that resolve the vulnerability |
| **Mapping Coverage** | Mapped / Total | % of findings mapped by skill vs raw tool |

### Ground Truth Format

Each benchmark case has labeled ground truth:

```json
{
  "id": "xss-001",
  "file": "reflected-xss.js",
  "vulnerable": true,
  "findings": [
    { "line": 8, "cwe": "CWE-079", "severity": "HIGH", "description": "..." }
  ]
}
```

Safe samples (`"vulnerable": false`) test false-positive resistance.

---

## Benchmark Coverage

| CWE | Category | Cases | JS | Python | IaC |
|-----|----------|-------|----|--------|-----|
| CWE-079 | Cross-Site Scripting | 8 | ✅ | ✅ | — |
| CWE-089 | SQL Injection | 8 | ✅ | ✅ | — |
| CWE-078 | OS Command Injection | 7 | ✅ | ✅ | — |
| CWE-798 | Hardcoded Secrets | 8 | ✅ | ✅ | — |
| CWE-532 | Sensitive Data in Logs | 7 | ✅ | ✅ | — |
| CWE-327 | Weak Cryptography | 7 | ✅ | ✅ | — |
| CWE-330 | Insufficient Randomness | 7 | ✅ | ✅ | — |
| CWE-022 | Path Traversal | 8 | ✅ | ✅ | — |
| CWE-502 | Insecure Deserialization | 8 | ✅ | ✅ | — |
| CWE-287 | Authentication Bypass | 8 | ✅ | ✅ | — |
| CWE-862 | Missing Authorization | 8 | ✅ | ✅ | — |
| IaC | Terraform Misconfigs | 4 | — | — | ✅ |
| IaC | Kubernetes Misconfigs | 3 | — | — | ✅ |

**Total: 87 benchmark cases across 13 CWE categories.**

Each CWE group contains a mix of vulnerable fixtures (positive examples) and safe fixtures (negative examples that must not trigger).

---

## Output

### Console Output

```
══════════════════════════════════════════════════════════════
  AutoBench: Testing skill "sast-scan"
══════════════════════════════════════════════════════════════

  📄 Loaded: skills/sast-scan/SKILL.md
  🔧 Tool: semgrep
  📊 Mappings: 8 CWE rules
  🔧 Fix skill: fix-findings (CWE → AGENT_RULES.md)

  ━━ CWE-079: Cross-Site Scripting (5 cases) ━━

    xss-001... ✅ P:1 R:1 F1:1 (1250ms) [1/1 mapped]
    xss-004... ⚠️ P:0 R:0 F1:0 (1180ms) [0/1 mapped]

  ━━ CWE-089: SQL Injection (5 cases) ━━

    sqli-001... ✅ P:1 R:1 F1:1 (980ms) [1/1 mapped]
    sqli-004... ✅ P:1 R:1 F1:1 (920ms) [0/0 mapped]

╔══════════════════════════════════════════════════════════════╗
║  AGGREGATE               │ 33 cases │ P:0.870 R:0.930      ║
║  F1 Score                │ 0.899                            ║
╚══════════════════════════════════════════════════════════════╝

  📋 Improvement Opportunities:
    - False Negatives: CWE-330, CWE-287
      → Add semgrep rules to sast-scan SKILL.md
    - False Positives: xss-004
      → Add exclusion patterns to sast-scan SKILL.md
```

### results.tsv

Tab-separated metrics per iteration (like autoresearch's results.tsv):

```tsv
run_id  timestamp           cwe      tool    case_id  tp  fp  fn  precision  recall  f1    status   description
1       2026-03-26T10:00:00 CWE-079  semgrep xss-001  1   0   0   1.000      1.000   1.000 baseline 
1       2026-03-26T10:00:01 CWE-079  semgrep xss-004  0   1   0   0.000      0.000   0.000 baseline 
2       2026-03-26T10:05:00 CWE-079  semgrep xss-004  0   0   0   1.000      1.000   1.000 keep     iter-2 improved
```

### Dashboard (HTML)

Generated at `results/dashboard/index.html` with:
- Summary cards (F1, Precision, Recall)
- CWE breakdown chart (grouped bar)
- Tool FP rate chart (horizontal bar)
- Score timeline (line chart)
- Detailed results table

---

## How Skills Are Evaluated

AutoBench tests the complete **skill pipeline**, not just raw tools:

```
                    ┌─────────────┐
                    │ SKILL.md    │
                    │ (sast-scan) │
                    └──────┬──────┘
                           │ defines
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │ CWE Mapping  │ │ Severity │ │ Exclusions   │
    │ Table        │ │ Mapping  │ │ (skip tests) │
    └──────┬───────┘ └────┬─────┘ └──────┬───────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                 ┌─────────────────┐
                 │ Skill-processed │
                 │ findings        │
                 └────────┬────────┘
                          ▼
                 ┌─────────────────┐
                 │ Ground truth    │
                 │ comparison      │
                 └─────────────────┘
```

Each layer is tested independently:
- **CWE Mapping**: Does `*.sql.injection.*` correctly map to CWE-89?
- **Severity**: Does `ERROR` correctly map to `HIGH`?
- **Exclusions**: Are test files properly excluded?
- **Fix Mapping**: Does fix-findings correctly map CWE-89 → Rule 2?

---

## File Structure

```
autobench/
├── run.ts                    CLI entry point (--loop, --skill, --dry-run, --provider)
├── runner.ts                 Pipeline orchestrator + auto-learning loop
├── skill.ts                  SKILL.md parser (CWE mapping, severity, exclusions)
├── executor.ts               Tool execution (semgrep, gitleaks)
├── evaluator.ts              TP/FP/FN → precision/recall/F1
├── git.ts                    Git operations (commit, revert, branch isolation)
├── types.ts                  TypeScript interfaces
│
├── agent/                    LLM agent subsystem
│   ├── proposer.ts           LLM proposer — calls Claude/OpenAI for change hypotheses
│   ├── proposer-rules.ts     Rule-based fallback proposer (no API key needed)
│   ├── prompts.ts            System + user prompt builders
│   └── validator.ts          Proposal validation (5 guards before any file is touched)
│
├── orchestration/            Loop control
│   └── promotion.ts          Promotion policy (F1 delta + 4 safety guards)
│
├── normalization/            Data normalization
│   └── cwe.ts                CWE format normalization (CWE-79 → CWE-079)
│
├── artifacts/                Persistence
│   └── decisions.ts          tried_changes.jsonl + decisions.jsonl I/O
│
└── __tests__/                Test suite (68 tests)
    ├── decisions.test.ts
    ├── llm-client.test.ts
    ├── promotion.test.ts
    ├── prompts.test.ts
    ├── proposer.test.ts
    └── validator.test.ts

benchmarks/
├── manifest.json             Index of all benchmark cases (87 total)
├── CWE-079-XSS/              8 cases (5v/3s) — JS, Python
├── CWE-089-SQLi/             8 cases (5v/3s) — JS, Python
├── CWE-078-CmdInjection/     7 cases (4v/3s) — JS, Python
├── CWE-798-HardcodedSecrets/ 8 cases (5v/3s) — JS, Python
├── CWE-532-LogSecrets/       7 cases (4v/3s) — JS, Python
├── CWE-327-WeakCrypto/       7 cases (4v/3s) — JS, Python
├── CWE-330-WeakRandom/       7 cases (4v/3s) — JS, Python
├── CWE-022-PathTraversal/    8 cases (5v/3s) — JS, Python
├── CWE-502-Deserialization/  8 cases (5v/3s) — JS, Python
├── CWE-287-AuthBypass/       8 cases (5v/3s) — JS, Python
├── CWE-862-MissingAuthz/     8 cases (5v/3s) — JS, Python
├── IaC-Terraform/            4 cases — HCL
└── IaC-Kubernetes/           3 cases — YAML
```

### Adding benchmark cases

Each CWE directory has a `ground.json` with the ground truth and the code files alongside it:

```json
{
  "cwe": "CWE-089",
  "name": "SQL Injection",
  "category": "Injection",
  "cases": [
    {
      "id": "sqli-009",
      "file": "new-vuln.py",
      "language": "python",
      "vulnerable": true,
      "findings": [
        { "line": 12, "cwe": "CWE-089", "severity": "CRITICAL", "description": "..." }
      ]
    },
    {
      "id": "sqli-010",
      "file": "new-safe.py",
      "language": "python",
      "vulnerable": false,
      "findings": [],
      "note": "Uses parameterized queries — must NOT trigger"
    }
  ]
}
```

Rules:
- `line` must exactly match the vulnerable line in the code file
- Safe cases must have `"vulnerable": false` and `"findings": []`
- After adding, update `benchmarks/manifest.json` with the new `caseCount` and `totalCases`

---

## Design Principles

1. **Skills are the product, not tools.** Semgrep finds patterns; the skill decides what to do with them.

2. **Ground truth is sacred.** Benchmark cases are never modified to make scores look better.

3. **Every improvement must be measurable.** F1 delta is the arbiter of keep vs revert.

4. **LLM proposes, evaluator decides.** The LLM generates hypotheses. Local code scores them. The LLM never decides whether a change is kept.

5. **Removing something that works equally well is a win.** Less surface area = fewer bugs.

---

## Influences and Prior Art

AutoBench applies the same meta-optimization pattern used across several systems to a new domain: security skill configuration.

### autoresearch — Andrej Karpathy (2026)

The direct inspiration. autoresearch runs an LLM agent on a single GPU to improve LLM training code overnight. Three formal primitives: editable asset (`train.py`), scalar metric (`val_bpb`), time-boxed cycle (5 minutes per experiment). 700 experiments in 2 days, 20 validated optimizations.

→ [github.com/karpathy/autoresearch](https://github.com/karpathy/autoresearch)

AutoBench applies the same pattern to security skills instead of training code:

| Aspect | autoresearch | AutoBench |
|--------|-------------|-----------|
| Editable asset | `train.py` | `skills/*/SKILL.md` + policies |
| Metric | `val_bpb` (bits per byte) | F1 (precision × recall) |
| Tool | PyTorch + GPU | Semgrep + Gitleaks + KICS |
| Cycle | 5-minute training run | ~30-60s benchmark suite |
| Budget | GPU hours | CPU minutes |
| Hypothesis generator | LLM agent | LLM agent |

### FunSearch — DeepMind (Nature, 2024)

An evolutionary procedure that pairs an LLM with a systematic evaluator to discover novel mathematical functions. The key principle: **the LLM proposes programs, the evaluator scores them, the evolutionary process promotes the best.** The LLM never judges quality — only the evaluator does. FunSearch discovered new solutions for the cap set problem.

→ [deepmind.google/blog/funsearch](https://deepmind.google/blog/funsearch-making-new-discoveries-in-mathematical-sciences-using-large-language-models/)

AutoBench adopts this separation directly: the LLM generates change hypotheses, the benchmark suite scores them, the promotion policy decides.

### AI Scientist — Sakana AI (Nature, 2025)

A fully automated scientific discovery system that generates hypotheses, runs experiments, and writes papers. First fully AI-generated paper to pass peer review. Independent evaluations found 42% experiment failure rates — highlighting that robust evaluation infrastructure is as important as the hypothesis generator.

→ [sakana.ai/ai-scientist](https://sakana.ai/ai-scientist-nature/)

AutoBench's strict validation pipeline (5 checks before any proposal is applied) addresses this class of reliability concern.

### SAST-Genius (2025)

A hybrid framework combining LLMs with Semgrep that reduced false positives by 91% (225 → 20) through LLM-powered triage and contextual validation. Uses LLMs at **inference time** to filter and contextualize raw scanner output.

→ [arxiv.org/abs/2509.15433](https://arxiv.org/abs/2509.15433)

AutoBench is complementary but different: it uses LLMs to **permanently improve the skill configuration** that governs scanner interpretation, not to triage individual findings at runtime.

### RE-Bench — METR (2024)

A benchmark for evaluating AI R&D capabilities on ML research engineering tasks. Frontier agents achieved 4× human expert scores at 2-hour budgets, establishing that LLM agents can perform meaningful research engineering. Methodology for measuring agent performance on open-ended optimization tasks directly informs AutoBench's evaluation design.

→ [metr.org/blog/re-bench](https://metr.org/blog/2024-11-22-evaluating-r-d-capabilities-of-llms/)

### GenProg and Automated Program Repair

A line of research using evolutionary search with test-suite fitness functions to repair programs automatically. Key lesson: simplistic fitness functions (pass/fail only) are insufficient — finer-grained metrics incorporating output distance and formal specifications produce better results.

→ [GECCO 2018](https://dl.acm.org/doi/10.1145/3205455.3205566)

AutoBench's multi-criteria promotion policy (F1 + protected guards) applies this lesson to skill optimization.

---

## License

Apache-2.0 — Part of [agent-security-policies](https://github.com/raomaster/agent-security-policies).
