# agent-security-policies

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.6-green.svg)](CHANGELOG.md)
[![OWASP ASVS](https://img.shields.io/badge/OWASP_ASVS-5.0.0-orange.svg)](policies/owasp_asvs.yaml)
[![CWE Top 25](https://img.shields.io/badge/CWE_Top_25-2025-red.svg)](policies/cwe_top25.yaml)

> **Portable, standards-backed security policies for any AI coding agent.**
>
> AI coding agents generate code fast — but without guardrails, they also generate vulnerabilities fast. This project provides a drop-in security policy layer that works with **10+ agents and IDEs**, backed by OWASP, NIST, CWE, and SLSA standards.
>
> One install command. Zero dependencies. Every agent speaks security.

---

## Installation

### For Humans

Copy and paste this prompt into your LLM agent (Claude Code, Cursor, Windsurf, etc.):

```
Install agent-security-policies by following the instructions at:
https://raw.githubusercontent.com/raomaster/agent-security-policies/main/docs/installation.md
```

The agent will ask a few questions about your setup and install the right configuration automatically.

### For LLM Agents

Fetch the installation guide and follow it:

```bash
curl -fsSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/docs/installation.md
```

### Skip This README

We're past the era of reading docs. Just paste this into your agent:

```
Read this and configure my project with agent-security-policies:
https://raw.githubusercontent.com/raomaster/agent-security-policies/main/docs/installation.md
```

---

## Table of Contents

- [Quick Install](#quick-install)
- [Contents](#contents)
- [Agent Security Skills](#-agent-security-skills-new-in-v13)
- [Agent Security Commands](#agent-security-commands)
- [Delivery Options](#delivery-options)
- [Enforcement Levels](#enforcement-levels)
- [Agent Setup](#agent-setup)
  - [GitHub Copilot](#github-copilot)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
  - [Claude (Anthropic)](#claude-anthropic)
    - [Via Claude Code CLI](#via-claude-code-cli)
    - [Via claude.ai Projects](#via-claudeai-projects)
    - [Via API](#via-api-1)
  - [ChatGPT / GPT API](#chatgpt--gpt-api)
  - [Gemini / Antigravity](#gemini-code-assist--antigravity)
  - [Cline / Roo Code](#cline--roo-code-vs-code)
  - [Aider](#aider)
  - [Continue.dev](#continuedev)
  - [OpenCode](#opencode)
  - [Aegis Security Agent](#aegis-security-agent)
- [Monorepo Configuration](#monorepo-configuration)
- [CI Enforcement](#ci-enforcement-recommended)
- [Standards Covered](#standards-covered)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Install

One command — zero dependencies. Copies `AGENT_RULES.md` + `policies/` + `skills/` and generates the config file your agent auto-detects.

### npx (Cross-platform — recommended)

```bash
# All agents + security skills
npx agent-security-policies --all

# Interactive mode — guided setup
npx agent-security-policies

# Specific agents only
npx agent-security-policies --agent copilot,claude --skills

# OpenCode with oh-my-openagent (installs Aegis agent + commands)
npx agent-security-policies --agent opencode --skills --omo

# Claude Code with Aegis subagent (installs CLAUDE.md + commands + .claude/agents/aegis.md)
npx agent-security-policies --agent claude --skills --aegis

# Local-only setup (files gitignored, each dev runs npx after clone)
npx agent-security-policies --all --gitignore

# List available agents, profiles, and skills
npx agent-security-policies --list
```

### Linux / macOS

```bash
# All agents + security skills (Copilot, Codex CLI, Claude CLI, Antigravity)
curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --all

# Specific agents only
curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --agent copilot,claude
```

### Windows (PowerShell)

```powershell
# All agents + security skills
irm https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.ps1 | iex

# Or download and run with options
Invoke-WebRequest -Uri https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.ps1 -OutFile install.ps1
.\install.ps1 -Agent copilot,codex,claude,antigravity
```

### From local clone

```bash
git clone https://github.com/raomaster/agent-security-policies.git
cd agent-security-policies
./install.sh --all --target /path/to/your/project
```

`--all` installs both agent configs and the full security skills pack. Use `--agent ...` without `--skills` for rules-only setup.

### What gets generated

| Agent | File created | Auto-detected by |
|-------|-------------|------------------|
| GitHub Copilot | `.github/copilot-instructions.md` | VS Code + JetBrains |
| Codex CLI | `AGENTS.md` | Codex CLI (OpenAI) |
| Claude Code | `CLAUDE.md` | Claude Code (Anthropic) |
| Claude Code + Aegis | `CLAUDE.md` + `.claude/agents/aegis.md` | Claude Code — auto-delegates security tasks |
| Antigravity | `.agent/rules/security.md` | Gemini (Google) |
| OpenCode | `.claude/rules/security.md` | oh-my-openagent |
| OpenCode + Aegis | `.claude/rules/security.md` + `.opencode/agents/aegis.md` | oh-my-openagent — `mode: all` |

All files reference `AGENT_RULES.md` with key rules inline. Non-destructive — existing files are never overwritten; security rules are appended with your confirmation.

---

## Contents

```text
.
├── AGENT_RULES.md              ← Main system prompt (feed this to your agent)
├── AGENT_RULES_LITE.md         ← Compact profile (~1K tokens) for local LLMs
├── README.md                   ← Setup instructions (you are here)
├── policies/                   ← YAML security policies (11 domains, OWASP, NIST)
│   ├── base_policy.yaml        ← 11 security domains (always active)
│   ├── owasp_asvs.yaml         ← ASVS 5.0.0 checklist (V1-V17)
│   ├── owasp_masvs.yaml        ← MASVS 2.1.0 controls (mobile only)
│   ├── owasp_proactive_controls.yaml ← Proactive Controls 2024 (C1-C10)
│   ├── cwe_top25.yaml          ← 25 CWE/SANS 2025 prevention rules
│   └── llm_security.yaml       ← OWASP LLM Top 10 2025 controls
├── skills/                     ← 🚀 Executable Agent Security Skills
│   ├── sast-scan/              ← Code vulnerabilities via Semgrep
│   ├── secrets-scan/           ← Hardcoded credentials via Gitleaks
│   ├── dependency-scan/        ← Known CVEs via Trivy
│   ├── container-scan/         ← Container image scanning via Trivy
│   ├── iac-scan/               ← Infrastructure as Code via Trivy
│   ├── threat-model/           ← STRIDE threat modeling
│   ├── fix-findings/           ← Automated remediation from scan outputs
│   └── security-review/        ← Multi-phase code review (no Docker)
└── commands/                   ← 💬 User-invocable Agent Commands
    ├── security-review.md      ← /security-review — full security audit
    ├── checkpoint.md           ← /checkpoint — git stash before risky ops
    └── rollback.md             ← /rollback — revert to a named checkpoint
```

---

## 🚀 Agent Security Skills (NEW in v1.3)

`agent-security-policies` ships with an extensible framework of **Security Skills** — atomic, zero-dependency actions that your AI agent can execute to proactively locate and fix security vulnerabilities.

| Skill | Tool | Output |
|-------|------|--------|
| `sast-scan` | Semgrep | CWE-mapped code vulnerabilities (JSON) |
| `secrets-scan` | Gitleaks | Hardcoded secrets and credentials (JSON) |
| `dependency-scan` | Trivy | Known CVEs in packages (JSON) |
| `container-scan` | Trivy | Container image misconfigurations (JSON) |
| `iac-scan` | Trivy | Terraform / Helm / K8s issues (JSON) |
| `threat-model` | Agent | STRIDE threat model (Markdown) |
| `fix-findings` | Agent | Automated fixes from any scan output |
| `security-review` | Agent | Multi-phase code review, no Docker required |

Skills chain together: `sast-scan` → `fix-findings`, `dependency-scan` → `fix-findings`.

> Want your agent to learn a new trick? See the [Skills Design and Creation Guide](skills/README.md).

---

## Agent Security Commands

`agent-security-policies` ships with **3 user-invocable commands** that you can trigger directly in your agent session. Installed to `.opencode/command/` (oh-my-openagent) or the agent-specific commands directory.

| Command | Invocation | When to use |
|---------|-----------|-------------|
| `security-review` | `/security-review` | Full 3-phase security audit: static analysis → dependency check → secrets scan |
| `checkpoint` | `/checkpoint [label]` | Before asking the agent to do something large or risky |
| `rollback` | `/rollback [label]` | When the agent's output is not acceptable and you need to revert |

### /checkpoint — manual safety net

`/checkpoint` creates a labeled `git stash` of your current working tree, then immediately restores it (`git stash pop`). The stash stays as a recoverable backup while you continue working.

**When to run it:**
- Before a large refactor you are not sure about
- Before asking the agent to touch auth, crypto, or session logic
- Before a database schema migration
- Before mass file deletions or moves
- Before upgrading multiple dependencies at once

**When NOT to run it:**
- Before routine edits (typo fix, comment, formatting)
- When the working tree is clean — git history already covers you

> Aegis will suggest `/checkpoint` when it detects a high-risk task, but it will never invoke it automatically. The decision is always yours.

```bash
/checkpoint before-auth-refactor
# ... let the agent work ...
/rollback before-auth-refactor   # if something goes wrong
```

### /rollback — undo agent changes

`/rollback [label]` restores the working tree to a named checkpoint. If no label is given, it lists available checkpoints and asks which one to restore.

> Rollback is cheaper than trying to repair bad agent output with follow-up prompts. Roll back → improve the plan → retry.

Install commands with:

```bash
npx agent-security-policies --agent opencode --skills --omo
```

---

## Delivery Options

1. **Canonical repo-root (recommended)**
   - Keep `AGENT_RULES.md` and `policies/` at project root.
   - Lowest maintenance, easiest for CI and contributors.
2. **Shared monorepo policy**
   - Keep a single policy set at monorepo root and reference it from each service.
   - Best when all teams must enforce the same baseline.
3. **Per-service policy**
   - Each service owns its own `AGENT_RULES.md` and `policies/`.
   - Best when risk profiles differ (for example, `payments` vs `frontend`).

---

## Enforcement Levels

After installing, you can tune **how strictly** your agent enforces the rules by adding one of these snippets to your agent's instructions. This is independent of `--profile` (which controls file size / token budget).

### Minimal

```
Read and follow AGENT_RULES.md for secure coding basics.
Use policies/base_policy.yaml as mandatory baseline.
```

### Standard (default behavior — no extra instructions needed)

```
Read and follow AGENT_RULES.md.
Apply policies/base_policy.yaml + policies/owasp_asvs.yaml.
Use cwe_top25.yaml as prevention checklist during implementation.
```

### Strict

```
Enforce ALL rules in AGENT_RULES.md and ALL YAML files in policies/.
Block insecure patterns (hardcoded secrets, shell=True, unvalidated input).
Require ASVS chapter-by-chapter audit with severity scoring before final output.
```

> **Tip:** Enforcement levels work with any profile. For example, `--profile lite` + a Strict snippet gives you compact rules with maximum rigor.

---

## Agent Setup

### GitHub Copilot

#### VS Code + JetBrains (universal method)

Create `.github/copilot-instructions.md` at the project root. Copilot Chat reads this file **automatically** in both VS Code and JetBrains — no IDE settings needed.

```markdown
Follow ALL security and code quality rules defined in AGENT_RULES.md.

Key mandatory rules:
- Apply OWASP ASVS 5.0.0 to every change
- Prevent all CWE/SANS Top 25 2025 weaknesses
- Use typed exceptions, never bare except
- Never hardcode secrets (CWE-798)
- Validate all inputs at trust boundaries (CWE-20)
- shell=False in subprocess calls (CWE-78)
- Type hints + docstrings on all public APIs
- Structured logging with correlation IDs

Reference policies/ for detailed YAML security rulesets.
```

#### VS Code — additional option (settings.json)

Add this to `.vscode/settings.json` (project-level) or your User Settings JSON (global):

```json
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "file": "AGENT_RULES.md"
    }
  ]
}
```

> **How to open Settings JSON:** `Ctrl+Shift+P` → `Preferences: Open User Settings (JSON)`

#### JetBrains — additional option (IDE settings)

1. Go to **Settings** → **Languages & Frameworks** → **GitHub Copilot**
2. Find the **Copilot Chat** → **Custom Instructions** field
3. Paste:

```
Follow ALL security rules in AGENT_RULES.md.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, NIST SSDF to every change.
Never hardcode secrets. Validate all inputs. Use typed exceptions.
Reference policies/ for YAML security rulesets.
```

#### Summary

| IDE | Easiest method | Where |
|-----|---------------|-------|
| VS Code | Create file | `.github/copilot-instructions.md` (auto-detected) |
| VS Code | Settings JSON | `github.copilot.chat.codeGeneration.instructions` |
| JetBrains | Create file | `.github/copilot-instructions.md` (auto-detected) |
| JetBrains | IDE Settings | Settings → GitHub Copilot → Custom Instructions |

---

### Cursor

#### Option A: Project rules file

Create `.cursorrules` at the project root:

```
Read and follow ALL rules in AGENT_RULES.md for every code change.
Use policies/ as structured security reference.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, NIST SSDF to all output.
```

#### Option B: IDE settings

Go to **Cursor Settings** → **General** → **Rules for AI** and paste:

```
For this project, always read and follow the security and code quality rules
defined in AGENT_RULES.md before writing any code. Apply the
OWASP ASVS 5.0.0 checklist, CWE/SANS Top 25 2025, and all mandatory rules
from that document to every change.
```

---

### Windsurf

Create `.windsurfrules` at the project root:

```
Read AGENT_RULES.md and follow every rule for all code generation,
modification, and review. Apply the security policies in policies/
to all output. Never skip security controls.
```

---

### Claude (Anthropic)

#### Via Claude Code CLI

Claude Code reads `CLAUDE.md` automatically from the project root and loads `.claude/commands/` as slash commands. Install the full stack:

```bash
# Rules + security skills + slash commands
npx agent-security-policies --agent claude --skills
```

This creates:
- `CLAUDE.md` — security policy loaded on every session (passive baseline)
- `.claude/commands/security-review.md` — `/security-review` slash command
- `.claude/commands/checkpoint.md` — `/checkpoint` slash command
- `.claude/commands/rollback.md` — `/rollback` slash command

##### Do you need Aegis as a Claude Code subagent?

Claude Code supports custom subagents via `.claude/agents/`. The security stack works in three layers — you can use any combination:

| Layer | File | Activation | What it gives you |
|-------|------|-----------|-------------------|
| **Baseline** | `CLAUDE.md` | Every session — automatic | Rules always in context. No extra steps. |
| **Commands** | `.claude/commands/` | You type `/security-review` | Explicit workflows you control. |
| **Subagent** | `.claude/agents/aegis.md` | On-demand delegation or `claude --agent aegis` | Isolated security review that doesn't consume main context. Auto-triggers when Claude detects security-relevant tasks. |

**When `CLAUDE.md` + commands are enough:**
- Small teams or solo projects where you already think security-first
- You remember to run `/security-review` before PRs
- Lightweight setups where you want minimum file footprint

**When Aegis as a subagent adds real value:**
- You want Claude to proactively flag security issues without you asking
- Security review should not bloat the main conversation context
- You want a consistent security persona with project-level memory
- You run sessions with `claude --agent aegis` to make it the primary agent

> **Key difference from OpenCode:** OpenCode's `mode: all` activates Aegis on *every* task automatically. In Claude Code, Aegis is triggered by description-matching delegation or explicitly via `claude --agent aegis`. Use `claude --agent aegis` at the start of a session when you want full-session coverage.

##### Install Aegis for Claude Code

```bash
# Installs CLAUDE.md + commands + .claude/agents/aegis.md
npx agent-security-policies --agent claude --skills --aegis
```

This adds `.claude/agents/aegis.md` — a subagent with isolated context, preloaded security skills, and a description that triggers automatic delegation for security tasks.

See [Aegis Security Agent](#aegis-security-agent) for full details.

#### Via claude.ai Projects

1. Go to **Projects** → **Project Knowledge**
2. Upload `AGENT_RULES.md`
3. Upload YAML files from `policies/` (and include `owasp_masvs.yaml` for mobile apps)
4. In **Project Instructions**, paste:

```
You are a secure coding agent. Follow ALL rules in the uploaded
AGENT_RULES.md document. Apply the YAML security policies to every
code change. Never skip security controls. When auditing code, use
the OWASP ASVS 5.0.0 checklist with severity scoring from the document.
```

#### Via API

```python
system_prompt = open("AGENT_RULES.md").read()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=system_prompt,
    messages=[{"role": "user", "content": "Build a REST API for user management"}]
)
```

---

### ChatGPT / GPT API

#### Via Custom GPT (chat.openai.com)

1. Go to **Explore GPTs** → **Create a GPT**
2. In **Instructions**, paste the entire contents of `AGENT_RULES.md`
3. Upload the 4 YAML policy files under **Knowledge**

#### Via API

```python
system_prompt = open("AGENT_RULES.md").read()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Build a REST API for user management"}
    ]
)
```

---

### Gemini Code Assist / Antigravity

#### Gemini in IDE

Create `.gemini/settings.json`:

```json
{
  "codeAssist": {
    "systemInstructions": "Read and follow all rules in AGENT_RULES.md. Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, and NIST SSDF to all code."
  }
}
```

#### Antigravity with workflows

Create `.agent/workflows/secure-coding.md`:

```markdown
---
description: Apply secure coding standards to all changes
---
1. Read `AGENT_RULES.md` for the complete security ruleset.
2. Apply all 11 mandatory rule domains to every code change.
3. Reference `policies/` for detailed YAML policies.
4. When planning, include a STRIDE threat model.
5. When reviewing, use the OWASP ASVS 5.0.0 checklist and severity scoring.
```

---

### Cline / Roo Code (VS Code)

Create `.clinerules` at the project root:

```
Read AGENT_RULES.md and follow ALL rules.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, and NIST SSDF.
Use policies/ YAML files as structured reference.
```

---

### Aider

#### Option A: Config file

Create `.aider.conf.yml` at the project root:

```yaml
read:
  - AGENT_RULES.md
```

#### Option B: CLI flag

```bash
aider --read AGENT_RULES.md
```

---

### Continue.dev

Edit `.continue/config.json`:

```json
{
  "systemMessage": "Read and follow all security rules in AGENT_RULES.md. Apply OWASP ASVS 5.0.0, CWE/SANS Top 25, and all mandatory rules to every code change.",
  "docs": [
    {
      "title": "Security Rules",
      "startUrl": "AGENT_RULES.md"
    }
  ]
}
```

---

### OpenCode

OpenCode reads rules from `.claude/rules/` automatically via oh-my-openagent.

#### Vanilla mode (without oh-my-openagent)

Place `AGENT_RULES.md` at project root. OpenCode will pick it up if you reference it in your session.

#### With oh-my-openagent (recommended)

oh-my-openagent discovers rules, skills, and commands from standard directories:

```bash
# Install rules + skills + Aegis agent + commands
npx agent-security-policies --agent opencode --skills --omo

# Or with gitignore support
npx agent-security-policies --agent opencode --skills --omo --gitignore
```

This creates:
- `.claude/rules/security.md` — auto-loaded security rules
- `.opencode/skills/security-review/SKILL.md` — security-review skill
- `.opencode/command/security-review.md` — `/security-review` command
- `.opencode/command/checkpoint.md` — `/checkpoint` command
- `.opencode/command/rollback.md` — `/rollback` command
- `.opencode/agents/aegis.md` — Aegis security subagent (see below)

---

### Aegis Security Agent

**Aegis** is a specialized security subagent that enforces OWASP, CWE/SANS, and NIST standards. It can be installed for both Claude Code and OpenCode, but behaves differently in each:

| | OpenCode + oh-my-openagent | Claude Code |
|--|---------------------------|-------------|
| **Install path** | `.opencode/agents/aegis.md` | `.claude/agents/aegis.md` |
| **Activation** | `mode: all` — every task, automatically | Description-based delegation or `claude --agent aegis` |
| **Coverage** | Always active, zero configuration | On-demand by default; session-wide with `--agent` flag |
| **Install command** | `--agent opencode --omo` | `--agent claude --aegis` |

#### What Aegis does (both platforms)

- Reads `AGENT_RULES.md` before every task
- Enforces OWASP ASVS 5.0.0 + Proactive Controls 2024
- Prevents all CWE/SANS Top 25 2025 weaknesses
- Enforces Git Safety Protocol (Rule 12)
- Suggests `/checkpoint` before high-risk operations — never auto-invokes it
- Runs security scans using the bundled skills (SAST, secrets, dependency, IaC)
- Reports findings with CWE/CVE/OWASP mapping and severity triage

#### Install for OpenCode (oh-my-openagent)

```bash
npx agent-security-policies --agent opencode --omo
```

Installs to `.opencode/agents/aegis.md`. With `mode: all`, Aegis shadows every OpenCode task — no invocation needed.

#### Install for Claude Code

```bash
npx agent-security-policies --agent claude --skills --aegis
```

Installs to `.claude/agents/aegis.md`. Claude automatically delegates security-related tasks to Aegis based on the agent description. For full-session coverage, start Claude Code with:

```bash
claude --agent aegis
```

This makes Aegis the primary agent for the session — its security-focused system prompt replaces the default Claude Code prompt.

#### Install for both

```bash
npx agent-security-policies --agent opencode,claude --skills --omo --aegis
```

Aegis is non-destructive — if the target file already exists, the installer skips it.

---

## Monorepo Configuration

### Case A: Centralized policy at repo root

Keep one shared policy folder and reference it from each package/app.

Example `.github/copilot-instructions.md` in a package:

```markdown
Follow ALL rules in ../../AGENT_RULES.md.
Reference ../../policies/ for YAML security policies.
```

### Case B: Per-service isolation

Use per-service policy files when teams need different strictness:

```
services/
  payments/AGENT_RULES.md
  payments/policies/
  identity/AGENT_RULES.md
  identity/policies/
```

This allows stricter rules (for example, payments) without affecting other services.

---

## CI Enforcement (Recommended)

Use CI to prevent drift between instructions and policy files.

### Example GitHub Actions check

```yaml
name: Validate Security Policies
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install pyyaml
      - run: python -c "import yaml,glob; [yaml.safe_load(open(f,encoding='utf-8')) for f in glob.glob('policies/*.yaml')]; print('YAML OK')"
      - run: test -f AGENT_RULES.md
```

### Optional CI policy gates

- Fail PR if `AGENT_RULES.md` changes without corresponding `CHANGELOG.md` update
- Fail PR if policy version is not bumped after security rule changes
- Fail PR if `README.md` agent snippets reference missing files

---

## Standards Covered

| Standard | Version | Coverage |
|----------|---------|----------|
| OWASP ASVS | 5.0.0 | Full — policy YAML + V1-V17 audit checklist |
| OWASP MASVS (mobile) | 2.1.0 | Full — policy YAML, 8 mobile security categories |
| OWASP Top 10 LLM | 2025 | Full — policy YAML, LLM01-LLM10 risks |
| OWASP Proactive Controls | 2024 | Full — policy YAML, C1-C10 proactive defenses |
| CWE/SANS Top 25 | 2025 | Full — policy YAML + all 25 weaknesses with prevention |
| NIST SP 800-218 (SSDF) | 1.1 | Rules — practices mapped to ASVS/CWE across rules 1-11 |
| NIST SP 800-53 | Rev 5 | Rules — AU-3 (logging), SI (integrity), SC (crypto), SA-12 (supply chain) |
| SLSA | 1.0 | Rules — dependency pinning, CVE audit, provenance (rule 7) |
| NIST AI RMF | 1.0 | Reference — applied via OWASP LLM Top 10 for AI/ML code |
| SOLID Principles | — | Reference — design guidance in code quality requirements |
| 12-Factor App | — | Reference — security-relevant factors: config (III), deps (II), logs (XI) |
| DORA Metrics | — | Reference — design goals for deployment frequency and change failure rate |

---

## Contributing

Contributions are welcome! Here are some ways to get involved:

- **Add security rules** — Reference a CWE, ASVS chapter, or NIST control in `AGENT_RULES.md`
- **Create a new skill** — See the [Skills Design and Creation Guide](skills/README.md)
- **Add agent support** — Add setup instructions for a new agent or IDE
- **Improve policies** — Extend or refine YAML policy files in `policies/`

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [ROADMAP.md](ROADMAP.md) for what's planned next.

---

## License

[Apache 2.0](LICENSE) — free to use, modify, and distribute with attribution.
