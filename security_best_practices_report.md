# Security Best Practices Audit Report

## Executive Summary

`agent-security-policies` is not a typical application; it is a distribution layer for secure coding guidance, installer logic, and portable agent skills. Its strongest traits are:

- a clear multi-agent installation model (`src/cli.ts`, `src/installer.ts`, `src/agents.ts`)
- standards-backed policy content (`AGENT_RULES.md`, `policies/*.yaml`)
- atomic, tool-oriented skills that are easy for agents to execute (`skills/*/SKILL.md`)

The main security and product risk is not in business logic exposure, but in **distribution integrity** and **security-by-default consistency**. The repo tells users to trust remote code execution paths and floating scanner images while also claiming strong supply-chain posture. Compared with the Codex `security-best-practices` skill and the listing at [skills.sh](https://skills.sh/supercent-io/skills-template/security-best-practices), this project is stronger on installation and portability, but weaker on **context-aware auditing**, **stack-specific guidance**, and **report-driven review workflows**.

**Verdict:** `CONDITIONAL`

Reason:
- 1 HIGH finding
- 2 MEDIUM findings
- several strategic gaps versus comparable security-review skills

## 1. Project Understanding

### 1.1 What the project is

This repository is a TypeScript/Node CLI plus shell installers that copy security rules, YAML policy packs, and security skills into target repositories.

Key components:

- `src/cli.ts`: CLI argument parsing, `--all`, `--agent`, `--skills`, `--profile`, interactive mode
- `src/installer.ts`: file installation, append/skip logic, skill translation per agent format, `.gitignore` management
- `src/agents.ts`: supported-agent registry and per-agent file generation strategy
- `AGENT_RULES.md` + `policies/*.yaml`: the canonical security guidance payload
- `skills/*/SKILL.md`: executable scanner/remediation instructions for agents

### 1.2 Product model

The repo is optimized around three ideas:

1. **Portable policy payload**
2. **Agent-specific translation**
3. **Atomic security skills**

That is materially different from a code scanner or a framework-specific secure-coding guide. The project is closer to a “security policy distribution kit for AI agents”.

### 1.3 Implementation evidence

- README positions the project as “portable, standards-backed security policies” and highlights a one-command install path: `README.md:8-12`, `README.md:42-105`
- Only four agents are implemented in code today: `src/agents.ts:17-71`
- Skills are deliberately defined as atomic and one-tool-per-skill: `skills/README.md:3-19`, `skills/README.md:30-34`

## 2. Comparison With Similar Initiatives

### 2.1 Codex `security-best-practices` skill

The Codex skill you shared is a **contextual audit skill**. Its main characteristics are:

- identify the full stack first
- load only relevant language/framework references
- support passive review and formal report mode
- write a prioritized Markdown security report with line-number references
- favor one-finding-at-a-time remediation

That makes it well suited for **security assessment work**.

### 2.2 `skills.sh/supercent-io/skills-template/security-best-practices`

The [skills.sh listing](https://skills.sh/supercent-io/skills-template/security-best-practices) presents the same initiative as a reusable skill asset. In practice, it sits in the same category as the Codex skill above: a reusable review workflow, not an installable security policy pack.

### 2.3 Where this repo is stronger

- Better installation story across multiple agents
- Clearer separation between canonical rules and translated agent artifacts
- Machine-readable policy files in `policies/`
- More execution-oriented atomic skills (`sast-scan`, `secrets-scan`, `dependency-scan`, etc.)

### 2.4 Where this repo is weaker

- No first-class “security audit / best-practices review” skill
- No stack-aware `references/` library like the Codex skill model
- No built-in report-generation workflow for best-practice audits
- No adaptive decision tree that selects guidance by language/framework
- Current skills emphasize tool execution over contextual review

## 3. Findings

## HIGH

### ASP-001: Remote install paths execute unpinned code from `main` without integrity verification

**Impact:** A compromise of the GitHub repo, branch, or delivery path can become immediate arbitrary code execution on user machines during installation.

**Evidence**

- README recommends `curl ... | bash` from the `main` branch: `README.md:67-72`
- README recommends `irm ... | iex` for PowerShell: `README.md:77-83`
- Bash installer downloads from `https://raw.githubusercontent.com/raomaster/agent-security-policies/main`: `install.sh:14`
- Bash installer fetches remote files without checksum or signature validation: `install.sh:124-133`
- PowerShell installer does the same via `Invoke-RestMethod`: `install.ps1:29`, `install.ps1:106-115`

**Why this matters**

The project’s own rules require strong supply-chain hygiene (`AGENT_RULES.md:87-93`), but the primary installation path is trust-on-first-use against a moving branch tip. That is not consistent with SLSA-style provenance goals.

**Recommended fix**

- Stop documenting `curl | bash` and `irm | iex` as primary install paths
- Publish release artifacts pinned to immutable tags or commit SHAs
- Provide checksums/signatures for installers
- Make the recommended flow “download, verify checksum, then execute”
- In bash, use `curl -fsSL` at minimum so HTTP failures do not silently write error pages

## MEDIUM

### ASP-002: Skills rely on floating `latest` container tags, contradicting the project’s own supply-chain guidance

**Impact:** Scanner behavior is non-deterministic across runs and can change or break unexpectedly; a compromised or bad upstream image propagates directly into user workflows.

**Evidence**

- Semgrep uses `semgrep/semgrep:latest`: `skills/sast-scan/SKILL.md:21`
- Gitleaks uses `zricethezav/gitleaks:latest`: `skills/secrets-scan/SKILL.md:22`, `skills/secrets-scan/SKILL.md:30`
- Trivy uses `aquasec/trivy:latest`: `skills/dependency-scan/SKILL.md:21`, `skills/dependency-scan/SKILL.md:43`, `skills/container-scan/SKILL.md:22`, `skills/container-scan/SKILL.md:32`, `skills/container-scan/SKILL.md:62`
- KICS uses `checkmarx/kics:latest`: `skills/iac-scan/SKILL.md:21`, `skills/iac-scan/SKILL.md:44`, `skills/iac-scan/SKILL.md:49`, `skills/iac-scan/SKILL.md:54`
- The project’s own rule says to pin dependency versions: `AGENT_RULES.md:87-93`

**Recommended fix**

- Pin scanner images to immutable versions or digests
- Document an update process for bumping scanner versions
- Optionally support `TOOL_IMAGE_OVERRIDE` env vars for advanced users

### ASP-003: Publish pipeline is not reproducible and is currently broken as committed

**Impact:** Release automation is unreliable, and the npm package build path cannot currently be reproduced from the repository state alone.

**Evidence**

- GitHub Actions publish workflow uses `npm ci`: `.github/workflows/publish-npm.yml:39-45`
- Repository has no `package-lock.json` or equivalent lockfile
- `package.json` defines build scripts but no test/lint/verification step: `package.json:41-52`
- Local verification on March 9, 2026:
  - `npm ci` fails because there is no lockfile
  - `npm run build` cannot run in this workspace because `tsc` is not installed locally

**Why this matters**

For a package distributed through npm, build reproducibility and CI integrity are part of the security story. Right now the project claims strong standards backing, but the release pipeline does not meet a basic reproducibility bar.

**Recommended fix**

- Commit `package-lock.json`
- Add a CI job that always runs on PRs for `npm ci`, `npm run build`, and installer smoke tests
- Add at least one end-to-end smoke test that installs into a temporary directory and verifies generated files for each supported agent

## INFO

### ASP-004: The project lacks a first-class contextual audit skill, which is the main gap versus Codex `security-best-practices`

**Impact:** The repo is strong for deterministic scanning and rule distribution, but weaker for human-style, stack-aware, best-practice security reviews.

**Evidence**

- Skills are intentionally atomic and tool-oriented: `skills/README.md:3-19`, `skills/README.md:30-34`
- Current skill set includes scanners, threat modeling, and remediation, but no “best-practices review” meta-skill: `README.md:134-148`

**Why this matters**

The Codex skill and the `skills.sh` variant both support:

- framework/language identification
- contextual loading of relevant references
- formal report writing
- prioritized review beyond tool output

This repository does not yet offer that capability natively.

**Recommended fix**

- Add a new `skills/security-best-practices/` meta-skill
- Add a `references/` directory with language/framework-specific documents
- Add a standard report template and severity model

## 4. Strategic Observations

These are not direct vulnerabilities, but they matter for product quality and adoption.

### 4.1 Promise vs implementation gap

README says the project works with “10+ agents and IDEs” (`README.md:10`), but code-level installer support currently covers four agent IDs (`src/agents.ts:17-71`). Some of the rest are documented as manual setup paths, but the headline claim is easy to overread.

### 4.2 Agent-agnostic claim vs Python-leaning rules

The repo claims agent-agnostic guidance, but some canonical rules are Python-specific, for example `shell=False` and references to `shutil.which()` (`AGENT_RULES.md:95-101`). Those are valid secure coding examples, but they blur the boundary between principle-level guidance and stack-specific implementation guidance.

### 4.3 Strong product architecture

The separation between:

- canonical policy payload
- installer/translation logic
- atomic skills

is good. `src/agents.ts` is especially clean as a translation layer and is a solid foundation for future expansion.

## 5. Proposal for Improvement

## Phase 1: Distribution hardening

1. Replace moving-branch installer examples with immutable release artifact examples
2. Publish SHA256 checksums and document verification
3. Change bash examples to `curl -fsSLO ...` plus explicit execution
4. Pin all Docker image references in skill docs

## Phase 2: Reproducible delivery

1. Commit `package-lock.json`
2. Add CI for `npm ci`, `npm run build`, and installer smoke tests
3. Validate generated files for each supported agent in CI
4. Add regression tests for `stripYamlFrontmatter`, append behavior, and `.gitignore` block management

## Phase 3: Compete directly with contextual security-review skills

1. Add `skills/security-best-practices/SKILL.md`
2. Add `skills/security-best-practices/references/`
3. Support language/framework detection first, then selective reference loading
4. Standardize report generation to `security_best_practices_report.md`
5. Allow remediation mode after report generation, one finding at a time

## Phase 4: Clarify the content model

1. Keep `AGENT_RULES.md` principle-level and agent-agnostic
2. Move language-specific examples into reference files
3. Make `policies/*.yaml` the structured baseline
4. Make skills either:
   - scanner skills
   - review/meta-skills
   - remediation skills

## 6. Recommended Target State

If I were shaping the next version, I would position the project like this:

- **Core product:** portable multi-agent security policy installer
- **Operational layer:** pinned, deterministic scanner skills
- **Advisory layer:** contextual `security-best-practices` review skill with stack-specific references

That would make the project meaningfully stronger than either category alone:

- stronger than pure skill templates because it ships installation/distribution
- stronger than pure installer packs because it adds adaptive review intelligence

## 7. Validation Notes

Checks performed locally on March 9, 2026:

- Repository structure review
- Source review of CLI, installer, agents, README, skills, workflow
- `npm ci` execution: failed because no lockfile is committed
- `npm run build` execution: could not complete in this workspace because `tsc` is unavailable locally

## 8. Report Location

This report was written to:

- `security_best_practices_report.md`
