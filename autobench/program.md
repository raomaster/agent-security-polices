# AutoBench Agent Instructions

This is an experiment to have the agent autonomously improve the security skills.

## Setup

1. **Read the in-scope files** for full context:
   - `benchmarks/manifest.json` — benchmark cases index
   - `benchmarks/*/ground.json` — ground truth per CWE group
   - `skills/*/SKILL.md` — security skill instructions
   - `policies/*.yaml` — security policy files
   - `AGENT_RULES.md` — core security rules

2. **Verify benchmarks exist**: Check that `benchmarks/` contains all CWE groups and ground truth files.

3. **Initialize results**: Run `npx tsx autobench/run.ts --limit 1` to verify setup works.

4. **Confirm and go**: Confirm setup looks good.

## The Loop

LOOP FOREVER:

1. **Run benchmark**: `npx tsx autobench/run.ts`
2. **Analyze results**: Where are the false positives? False negatives?
3. **Identify pattern**: Group failures by type (FP vs FN) and CWE
4. **Improve**: Modify ONE of:
   - `skills/sast-scan/SKILL.md` — add false-positive exclusions, refine CWE mappings
   - `skills/secrets-scan/SKILL.md` — add exclusion patterns
   - `skills/fix-findings/SKILL.md` — improve CWE-to-rule mapping table
   - `policies/base_policy.yaml` — adjust severity levels
   - `policies/cwe_top25.yaml` — refine prevention rules
   - `AGENT_RULES.md` — add/modify security rules
5. **git commit** your change with descriptive message
6. **Re-run benchmark**: `npx tsx autobench/run.ts`
7. **Compare scores**:
   - If F1 improved (higher) → **keep** the commit (advance branch)
   - If F1 equal or worse → **discard** (git reset --hard to previous)
8. **Log to results.tsv** (automatically done by the tool)
9. **Repeat**

## What You CAN Modify
- `skills/*/SKILL.md` — instructions, false-positive exclusions, CWE mappings
- `policies/*.yaml` — rules, severity levels, CWE references
- `AGENT_RULES.md` — core security rules
- `.semgrepignore` — exclusion patterns

## What You CANNOT Modify
- `benchmarks/` — ground truth is FIXED. Never change it.
- `autobench/` — the benchmark tool itself
- `src/` — the CLI code

## Rules
- **NEVER** modify benchmark ground truth to make tests pass
- **NEVER** disable a rule to reduce false positives (fix the rule instead)
- Each improvement should be a **single, focused change**
- Log your **reasoning** in the commit message
- Weigh complexity cost vs improvement magnitude
- A small improvement that adds ugly complexity is not worth it
- Removing something and getting equal or better results is a win

## Output Format

The benchmark tool outputs per-case results:
```
  Scanning xss-001 (CWE-079)... ✅ (1250ms)
  Scanning xss-004 (CWE-079)... ⚠️ (1180ms)  ← False positive on safe code
```

And an aggregate report:
```
╔══════════════════════════════════════════════════════════════╗
║  CWE-079 (XSS)          │  5 cases │ P:0.800 R:1.000       ║
║  CWE-089 (SQLi)         │  5 cases │ P:0.833 R:1.000       ║
║  AGGREGATE               │ 33 cases │ P:0.870 R:0.930       ║
╚══════════════════════════════════════════════════════════════╝
```

## Metrics
- **Precision**: TP / (TP + FP) — how many findings are real
- **Recall**: TP / (TP + FN) — how many real vulns are found
- **F1**: harmonic mean of P and R — the primary score to maximize
- **F1 Delta**: change from previous run — positive means improvement

## Timeout
Each benchmark run takes ~30-60 seconds. There is no timeout — run until manually stopped.
The human may leave you running overnight. **NEVER STOP** asking "should I continue?".
