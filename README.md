# agent-rules/

> **Portable security configuration for any AI coding agent.**

Drop this folder into any project. Configure your agent as described below.

## Contents

```
agent-rules/
├── AGENT_RULES.md              ← Main system prompt (feed this to your agent)
├── README.md                   ← Setup instructions (you are here)
└── policies/
    ├── base_policy.yaml        ← 11 security domains (always active)
    ├── owasp_asvs.yaml         ← ASVS 5.0 audit checklist (V1-V14)
    ├── cwe_top25.yaml          ← 25 CWE/SANS 2025 prevention rules
    └── llm_security.yaml       ← OWASP LLM Top 10 2025 controls
```

---

## GitHub Copilot

### VS Code + JetBrains (método universal)

Create `.github/copilot-instructions.md` at the project root. Copilot Chat reads this file **automatically** in both VS Code and JetBrains — no IDE settings needed.

```markdown
Follow ALL security and code quality rules defined in agent-rules/AGENT_RULES.md.

Key mandatory rules:
- Apply OWASP ASVS 5.0 to every change
- Prevent all CWE/SANS Top 25 2025 weaknesses
- Use typed exceptions, never bare except
- Never hardcode secrets (CWE-798)
- Validate all inputs at trust boundaries (CWE-20)
- shell=False in subprocess calls (CWE-78)
- Type hints + docstrings on all public APIs
- Structured logging with correlation IDs

Reference agent-rules/policies/ for detailed YAML security rulesets.
```

### VS Code — additional option (settings.json)

You can also point Copilot directly to the full rules file. Add this to `.vscode/settings.json` (project-level) or your User Settings JSON (global):

```json
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "file": "agent-rules/AGENT_RULES.md"
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
Follow ALL security rules in agent-rules/AGENT_RULES.md.
Apply OWASP ASVS 5.0, CWE/SANS Top 25 2025, NIST SSDF to every change.
Never hardcode secrets. Validate all inputs. Use typed exceptions.
Reference agent-rules/policies/ for YAML security rulesets.
```

### Summary

| IDE | Easiest method | Where |
|-----|---------------|-------|
| VS Code | Create file | `.github/copilot-instructions.md` (auto-detected) |
| VS Code | Settings JSON | `github.copilot.chat.codeGeneration.instructions` |
| JetBrains | Create file | `.github/copilot-instructions.md` (auto-detected) |
| JetBrains | IDE Settings | Settings → GitHub Copilot → Custom Instructions |

---

## Cursor

### Option A: Project rules file

Create `.cursorrules` at the project root:

```
Read and follow ALL rules in agent-rules/AGENT_RULES.md for every code change.
Use agent-rules/policies/ as structured security reference.
Apply OWASP ASVS 5.0, CWE/SANS Top 25 2025, NIST SSDF to all output.
```

### Option B: IDE settings

Go to **Cursor Settings** → **General** → **Rules for AI** and paste:

```
For this project, always read and follow the security and code quality rules
defined in agent-rules/AGENT_RULES.md before writing any code. Apply the
OWASP ASVS 5.0 checklist, CWE/SANS Top 25 2025, and all mandatory rules
from that document to every change.
```

---

## Windsurf

Create `.windsurfrules` at the project root:

```
Read agent-rules/AGENT_RULES.md and follow every rule for all code generation,
modification, and review. Apply the security policies in agent-rules/policies/
to all output. Never skip security controls.
```

---

## Claude (Anthropic)

### Via claude.ai Projects

1. Go to **Projects** → **Project Knowledge**
2. Upload `agent-rules/AGENT_RULES.md`
3. Upload all 4 YAML files from `agent-rules/policies/`
4. In **Project Instructions**, paste:

```
You are a secure coding agent. Follow ALL rules in the uploaded
AGENT_RULES.md document. Apply the YAML security policies to every
code change. Never skip security controls. When auditing code, use
the OWASP ASVS 5.0 checklist with severity scoring from the document.
```

### Via API

```python
system_prompt = open("agent-rules/AGENT_RULES.md").read()

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
system_prompt = open("agent-rules/AGENT_RULES.md").read()

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
    "systemInstructions": "Read and follow all rules in agent-rules/AGENT_RULES.md. Apply OWASP ASVS 5.0, CWE/SANS Top 25 2025, and NIST SSDF to all code."
  }
}
```

### Antigravity with workflows

Create `.agent/workflows/secure-coding.md`:

```markdown
---
description: Apply secure coding standards to all changes
---
1. Read `agent-rules/AGENT_RULES.md` for the complete security ruleset.
2. Apply all 11 mandatory rule domains to every code change.
3. Reference `agent-rules/policies/` for detailed YAML policies.
4. When planning, include a STRIDE threat model.
5. When reviewing, use the OWASP ASVS 5.0 checklist and severity scoring.
```

---

## Cline / Roo Code (VS Code)

Create `.clinerules` at the project root:

```
Read agent-rules/AGENT_RULES.md and follow ALL rules.
Apply OWASP ASVS 5.0, CWE/SANS Top 25 2025, and NIST SSDF.
Use agent-rules/policies/ YAML files as structured reference.
```

---

## Aider

### Option A: Config file

Create `.aider.conf.yml` at the project root:

```yaml
read:
  - agent-rules/AGENT_RULES.md
```

### Option B: CLI flag

```bash
aider --read agent-rules/AGENT_RULES.md
```

---

## Continue.dev

Edit `.continue/config.json`:

```json
{
  "systemMessage": "Read and follow all security rules in agent-rules/AGENT_RULES.md. Apply OWASP ASVS 5.0, CWE/SANS Top 25, and all mandatory rules to every code change.",
  "docs": [
    {
      "title": "Security Rules",
      "startUrl": "agent-rules/AGENT_RULES.md"
    }
  ]
}
```

---

## OpenCode / PEA Engine

Already integrated — policies are loaded from `policies/` automatically and injected into Planner, Executor, and Auditor prompts. No configuration needed.

---

## Standards Covered

| Standard | Version |
|----------|---------|
| OWASP ASVS | 5.0 |
| OWASP Top 10 LLM | 2025 |
| CWE/SANS Top 25 | 2025 |
| NIST SP 800-218 (SSDF) | 1.1 |
| NIST SP 800-53 | Rev 5 |
| NIST AI RMF | 1.0 |
| SLSA | 1.0 |
| SOLID Principles | — |
| 12-Factor App | — |
| DORA Metrics | — |
