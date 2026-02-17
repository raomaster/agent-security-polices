# agent-security-policies

> **Portable security configuration for any AI coding agent.**

Use this repository as the canonical policy source in your project root.

## Quick Install

One command — zero dependencies. Copies `AGENT_RULES.md` + `policies/` and generates the config file your agent auto-detects.

### Linux / macOS

```bash
# All agents (Copilot, Codex CLI, Claude CLI, Antigravity)
curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --all

# Specific agents only
curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --agent copilot,claude
```

### Windows (PowerShell)

```powershell
# All agents
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

### What gets generated

| Agent | File created | Auto-detected by |
|-------|-------------|------------------|
| GitHub Copilot | `.github/copilot-instructions.md` | VS Code + JetBrains |
| Codex CLI | `AGENTS.md` | Codex CLI (OpenAI) |
| Claude CLI | `CLAUDE.md` | Claude Code (Anthropic) |
| Antigravity | `.agent/rules/security.md` | Gemini (Google) |

All files reference `AGENT_RULES.md` with key rules inline. Non-destructive — existing files are not overwritten.

---

## Contents

```
.
├── AGENT_RULES.md              ← Main system prompt (feed this to your agent)
├── README.md                   ← Setup instructions (you are here)
└── policies/
    ├── base_policy.yaml        ← 11 security domains (always active)
    ├── owasp_asvs.yaml         ← ASVS 5.0.0 checklist (V1-V17)
    ├── owasp_masvs.yaml        ← MASVS 2.1.0 controls (mobile only)
    ├── cwe_top25.yaml          ← 25 CWE/SANS 2025 prevention rules
    └── llm_security.yaml       ← OWASP LLM Top 10 2025 controls
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

## Configuration Profiles

Use one of these profiles depending on enforcement level:

### Minimal

```
Read and follow AGENT_RULES.md for secure coding basics.
Use policies/base_policy.yaml as mandatory baseline.
```

### Standard

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

---

## GitHub Copilot

### VS Code + JetBrains (método universal)

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

### VS Code — additional option (settings.json)

You can also point Copilot directly to the full rules file. Add this to `.vscode/settings.json` (project-level) or your User Settings JSON (global):

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

### JetBrains — additional option (IDE settings)

1. Go to **Settings** → **Languages & Frameworks** → **GitHub Copilot**
2. Find the **Copilot Chat** → **Custom Instructions** field
3. Paste:

```
Follow ALL security rules in AGENT_RULES.md.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, NIST SSDF to every change.
Never hardcode secrets. Validate all inputs. Use typed exceptions.
Reference policies/ for YAML security rulesets.
```

### Summary

| IDE | Easiest method | Where |
|-----|---------------|-------|
| VS Code | Create file | `.github/copilot-instructions.md` (auto-detected) |
| VS Code | Settings JSON | `github.copilot.chat.codeGeneration.instructions` |
| JetBrains | Create file | `.github/copilot-instructions.md` (auto-detected) |
| JetBrains | IDE Settings | Settings → GitHub Copilot → Custom Instructions |

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

## Cursor

### Option A: Project rules file

Create `.cursorrules` at the project root:

```
Read and follow ALL rules in AGENT_RULES.md for every code change.
Use policies/ as structured security reference.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, NIST SSDF to all output.
```

### Option B: IDE settings

Go to **Cursor Settings** → **General** → **Rules for AI** and paste:

```
For this project, always read and follow the security and code quality rules
defined in AGENT_RULES.md before writing any code. Apply the
OWASP ASVS 5.0.0 checklist, CWE/SANS Top 25 2025, and all mandatory rules
from that document to every change.
```

---

## Windsurf

Create `.windsurfrules` at the project root:

```
Read AGENT_RULES.md and follow every rule for all code generation,
modification, and review. Apply the security policies in policies/
to all output. Never skip security controls.
```

---

## Claude (Anthropic)

### Via claude.ai Projects

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

### Via API

```python
system_prompt = open("AGENT_RULES.md").read()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=system_prompt,
    messages=[{"role": "user", "content": "Build a REST API for user management"}]
)
```

---

## ChatGPT / GPT API

### Via Custom GPT (chat.openai.com)

1. Go to **Explore GPTs** → **Create a GPT**
2. In **Instructions**, paste the entire contents of `AGENT_RULES.md`
3. Upload the 4 YAML policy files under **Knowledge**

### Via API

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

## Gemini Code Assist / Antigravity

### Gemini in IDE

Create `.gemini/settings.json`:

```json
{
  "codeAssist": {
    "systemInstructions": "Read and follow all rules in AGENT_RULES.md. Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, and NIST SSDF to all code."
  }
}
```

### Antigravity with workflows

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

## Cline / Roo Code (VS Code)

Create `.clinerules` at the project root:

```
Read AGENT_RULES.md and follow ALL rules.
Apply OWASP ASVS 5.0.0, CWE/SANS Top 25 2025, and NIST SSDF.
Use policies/ YAML files as structured reference.
```

---

## Aider

### Option A: Config file

Create `.aider.conf.yml` at the project root:

```yaml
read:
  - AGENT_RULES.md
```

### Option B: CLI flag

```bash
aider --read AGENT_RULES.md
```

---

## Continue.dev

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

## OpenCode / PEA Engine

Already integrated — policies are loaded from `policies/` automatically and injected into Planner, Executor, and Auditor prompts. No configuration needed.

---

## Standards Covered

| Standard | Version |
|----------|---------|
| OWASP ASVS | 5.0.0 |
| OWASP MASVS (mobile) | 2.1.0 |
| OWASP Top 10 LLM | 2025 |
| CWE/SANS Top 25 | 2025 |
| NIST SP 800-218 (SSDF) | 1.1 |
| NIST SP 800-53 | Rev 5 |
| NIST AI RMF | 1.0 |
| SLSA | 1.0 |
| SOLID Principles | — |
| 12-Factor App | — |
| DORA Metrics | — |
