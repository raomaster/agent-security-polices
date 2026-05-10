---
name: security-review
description: Unified security review — Phase 1 agent analysis (diff vs main + STRIDE threat model, no tools needed), Phase 2 tool-based scans (sast-scan, secrets-scan, dependency-scan, container-scan, iac-scan) + fix-findings. Scoped to current branch changes vs main by default.
---

# Security Review — Unified

Run a complete security review of current changes. Combines agent-based analysis (no tools required) with automated tool scans. Default scope is the current branch diff vs main.

## Arguments

| Value | Behavior |
|-------|----------|
| *(empty)* or `diff` | Full review scoped to `git diff main...HEAD` |
| `full` | Full review on entire codebase |
| `agent-only` | Phase 1 only — no tools required |
| `tools-only` | Phase 2 only — skip agent analysis |

## Prerequisites

Phase 1 requires: nothing (agent knowledge only)
Phase 2 requires: Docker (for Semgrep, Gitleaks, Trivy) or local tool installations

---

## Determine Scope

```bash
git log --oneline main...HEAD
git diff main...HEAD --stat
```

- `diff` (default): review `git diff main...HEAD`
- `full`: review entire repository
- Review main branch only if a specific fix requires context not inferrable from the diff — document why when doing so

---

## Phase 1 — Agent Analysis (always runs first)

### 1.1 Diff Analysis

Review every changed file in scope for security vulnerabilities using agent knowledge.

For each changed file, check:

**Injection** (CWE-89, CWE-78, CWE-79):
- SQL: are queries parameterized? No string concatenation into SQL
- Shell: no `shell=True` / `exec()` with user input
- HTML output: is user input escaped?

**Authentication & Authorization** (CWE-287, CWE-862, CWE-306):
- New endpoints: are they behind auth checks?
- Permission checks: is authorization verified before action?
- Session management: tokens stored securely?

**Cryptography** (CWE-327, CWE-330, CWE-326):
- Weak algorithms: MD5, SHA1, DES, RC4 for security purposes?
- Insufficient randomness: `Math.random()` for tokens/secrets?
- Key length: RSA < 2048, AES < 128?

**Secret exposure** (CWE-798, CWE-532):
- Hardcoded credentials, API keys, tokens in code or config?
- Secrets logged or included in error messages?

**Input validation** (CWE-20):
- External inputs validated at trust boundaries?
- Path traversal possible? (CWE-22)

**Error handling** (CWE-209):
- Stack traces or internal details exposed to end users?

Apply OWASP ASVS 5.0.0 (V1-V17) and CWE/SANS Top 25 2025.

Output Phase 1 findings as a table:
```
| Severity | CWE       | File:Line        | Description                         |
|----------|-----------|------------------|-------------------------------------|
| HIGH     | CWE-089   | src/db.ts:42     | SQL query concatenates user input   |
```

### 1.2 STRIDE Threat Model on the Diff

For each new feature, endpoint, or attack surface introduced in the diff, apply STRIDE:

- **Spoofing** — can an attacker impersonate a user or system?
- **Tampering** — can data in transit or at rest be modified?
- **Repudiation** — can actions be denied without audit trail?
- **Information Disclosure** — can sensitive data be exposed?
- **Denial of Service** — can resources be exhausted or disrupted?
- **Elevation of Privilege** — can a lower-privileged actor gain higher access?

Output: threat table with likelihood (H/M/L) and recommended control.

---

## Phase 2 — Tool-Based Scans

Run applicable scan skills in order. Skip a scan if the tool is unavailable — note which scans were skipped.

### 2.1 sast-scan

Follow the `sast-scan` skill instructions.
Scope: files changed in diff (or full repo if `full` argument).

### 2.2 secrets-scan

Follow the `secrets-scan` skill instructions.
Scope: always full repo (secrets may be in any tracked file).

### 2.3 dependency-scan

Follow the `dependency-scan` skill instructions.
Run if a `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, or similar manifest is present.

### 2.4 container-scan

Follow the `container-scan` skill instructions.
Run only if a `Dockerfile`, `docker-compose.yml`, or container image reference is present or changed.

### 2.5 iac-scan

Follow the `iac-scan` skill instructions.
Run only if `.tf`, `.yaml` (k8s/Helm), or CloudFormation files are present or changed.

### 2.6 Consolidate findings

Merge Phase 1 and Phase 2 findings into a single list.
Deduplicate: if Phase 1 and a tool both flag the same CWE in the same file at the same line, keep one entry and note both sources.

---

## Phase 3 — Remediation

Follow the `fix-findings` skill instructions on the consolidated finding set.

Priority order: CRITICAL → HIGH → MEDIUM → LOW (skip INFO unless explicitly requested by the user).

After fixes are applied:
- Re-run affected scan skills to verify findings are resolved
- Update the findings table with "Fixed" or "Unresolved" status for each item

---

## Final Report

Present a summary after all phases complete:

```
## Security Review Summary

**Scope:** git diff main...HEAD (N files changed)
**Phases completed:** Agent analysis, Threat model, [list tools run]

### Findings

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | N     | N     | N         |
| HIGH     | N     | N     | N         |
| MEDIUM   | N     | N     | N         |
| LOW      | N     | N     | N         |

### Threats Identified (STRIDE)
[summary of threat model output]

### Skipped Scans
[list any tools that were unavailable with reason]
```
