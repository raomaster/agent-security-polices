# Roadmap

> Public roadmap for `agent-security-policies`.
> Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Completed

### v1.0 — Core ✅

| Deliverable | Status |
|-------------|--------|
| `AGENT_RULES.md` — 11 standards, 11 rule domains, CWE Top 25, STRIDE, ASVS audit checklist | ✅ |
| `policies/base_policy.yaml` — 11 security domains | ✅ |
| `policies/owasp_asvs.yaml` — ASVS 5.0.0 (V1-V17) | ✅ |
| `policies/cwe_top25.yaml` — CWE/SANS Top 25 2025 | ✅ |
| `policies/llm_security.yaml` — OWASP LLM Top 10 2025 | ✅ |
| `README.md` — Setup for 10 agents/IDEs | ✅ |

### v1.1 — Repo & Community ✅

| Deliverable | Status |
|-------------|--------|
| LICENSE (Apache 2.0) | ✅ |
| CONTRIBUTING.md | ✅ |
| CODE_OF_CONDUCT.md | ✅ |
| CHANGELOG.md | ✅ |
| .github/ issue templates (3) + PR template | ✅ |
| `policies/owasp_masvs.yaml` — MASVS 2.1.0 (mobile) | ✅ |
| Delivery options (repo-root, monorepo, per-service) | ✅ |
| Configuration profiles (Minimal / Standard / Strict) | ✅ |
| CI enforcement example (GitHub Actions) | ✅ |

### v1.2 — Install Scripts ✅

| Deliverable | Status |
|-------------|--------|
| `install.sh` — Bash installer (Linux/Mac), zero dependencies | ✅ |
| `install.ps1` — PowerShell installer (Windows), zero dependencies | ✅ |
| Local mode (from clone) + remote mode (curl from GitHub) | ✅ |
| Non-destructive: skips existing files, appends if needed | ✅ |
| `--all` / `--agent copilot,codex,claude,antigravity` flags | ✅ |
| `--target` flag for custom project directory | ✅ |
| Quick Install section in README.md | ✅ |

Agents auto-configured:

| Flag | Agent | File generated |
|------|-------|---------------|
| `copilot` | GitHub Copilot (VS Code + JetBrains) | `.github/copilot-instructions.md` |
| `codex` | Codex CLI (OpenAI) | `AGENTS.md` |
| `claude` | Claude CLI (Anthropic) | `CLAUDE.md` |
| `antigravity` | Antigravity (Google Gemini) | `.agent/rules/security.md` |

---

## Next Up

### v1.3 — Security Skills

> **Goal:** Reusable agent skills that run real security tools (SAST, SCA, secrets, IaC) and let the agent remediate findings.

**Priority: 🔴 High** — This is the core differentiator: real tools + AI remediation.

**Detection skills** — each runs ONE tool, produces ONE type of finding:

| Skill | Tool | Finding type | Output |
|-------|------|-------------|--------|
| `sast-scan` | Semgrep | **CWE** (code vulnerabilities) | SARIF/JSON |
| `secrets-scan` | Gitleaks | **Secrets** (hardcoded credentials) | JSON |
| `dependency-scan` | Trivy (fs mode) | **CVE** (vulnerable dependencies) | JSON |
| `container-scan` | Trivy (image mode) | **CVE** (container image vulns) | JSON |
| `iac-scan` | KICS (Checkmarx) | **Misconfigurations** (IaC) | JSON |

**Analysis skills** — agent-driven, no external tool:

| Skill | Input | Output |
|-------|-------|--------|
| `threat-model` | Component/feature description | STRIDE threat model (Markdown) |

**Remediation skills** — agent takes scan output and proposes fixes:

| Skill | Input | Output |
|-------|-------|--------|
| `fix-findings` | JSON output from any detection skill | Code changes based on AGENT_RULES.md |

```
sast-scan  ─────┐
secrets-scan ───┤
dependency-scan ┼──→ fix-findings ──→ remediated code
container-scan ─┤
iac-scan ───────┘
```

Skills are installed per-agent by `install.sh` / `install.ps1`:

| Agent | Skills location |
|-------|----------------|
| Antigravity | `.agent/skills/*/SKILL.md` |
| Claude CLI | `.claude/commands/*.md` |
| Copilot | `.github/prompts/*.prompt.md` |
| Codex CLI | Referenced in `AGENTS.md` |

**Compact version for local LLMs:**

| Deliverable | Tokens | Use case |
|-------------|--------|----------|
| `AGENT_RULES.md` (standard) | ~3K | Cloud LLMs (GPT-4o, Claude, Gemini) |
| `AGENT_RULES_LITE.md` (compact) | ~1K | Local LLMs (Ollama, LM Studio, llama.cpp) |

The lite version keeps only the top rules + CWE IDs, no explanations. Install scripts select via `--profile lite`.

**Definition of Done:**
- [ ] Each detection skill runs via Docker if tool not installed locally
- [ ] Each skill outputs structured JSON with CWE/CVE mapping
- [ ] `fix-findings` accepts output from any detection skill
- [ ] `threat-model` generates STRIDE table for a given component
- [ ] `AGENT_RULES_LITE.md` exists and is ≤1K tokens
- [ ] Skills work with Antigravity + Claude CLI (minimum)
- [ ] `install.sh --all` installs skills in correct locations

---

### v1.4 — CLI Tool (npx)

> **Goal:** `npx agent-security-policies` as an alternative delivery method. Wraps the same logic as install scripts.

**Priority: 🟡 Medium** — Part of the delivery mechanism, critical for adoption in Node.js ecosystems.

| Task | Notes |
|------|-------|
| npm package `agent-security-policies` | TypeScript CLI wrapping install script logic |
| `--agent <name>` flag | Target: copilot, codex, claude, antigravity (+ more in v1.5) |
| `--profile minimal\|standard\|strict` | Maps to config profiles from README |
| `--list` flag | Show available agents and profiles |
| Interactive mode | Prompt-based selection if no flags |
| Publish to npm | `npx agent-security-policies` works out of the box |

**Definition of Done:**
- [ ] `npx agent-security-policies --agent copilot --profile strict` generates valid config
- [ ] Published on npm
- [ ] README documents all CLI flags

---

### v1.5 — GitHub Pages + Community

> **Goal:** Make the project visible, accessible, and shareable. A polished website is the face of the project.

**Priority: 🟡 Medium** — Equal to delivery. No adoption without visibility.

**Project website (GitHub Pages):**

| Task | Notes |
|------|-------|
| Landing page with value proposition | Why use agent-security-policies? |
| Interactive rule browser | Search/filter rules by standard, severity, CWE |
| Quick start wizard | Select agent → copy one-liner → done |
| Skills catalog | Browse available skills with descriptions |
| Live demo / screenshots | Show what agents produce with rules active |
| Badge generator | "Secured by agent-security-policies" for READMEs |
| Docs site (auto-generated from repo) | `AGENT_RULES.md`, `ROADMAP.md`, policies rendered as pages |

**Community outreach:**

| Task | Notes |
|------|-------|
| Publish blog post / article | Dev.to, Medium, or personal blog |
| Create social media presence | Twitter/X, LinkedIn, Reddit (r/netsec, r/devsecops) |
| Submit to awesome lists | `awesome-security`, `awesome-llm`, `awesome-devsecops` |
| Conference lightning talk / CFP | BSides, OWASP chapter, DevSecCon |
| Community Discord or GitHub Discussions | Low-friction communication channel |

**Definition of Done:**
- [ ] GitHub Pages site live at `https://raomaster.github.io/agent-security-policies`
- [ ] Badge SVG available and documented in README
- [ ] At least 1 blog post / article published
- [ ] Submitted to ≥3 awesome lists

---

### v1.6 — More Agents + Optional Skills

> **Goal:** Expand agent support and add optional quality/testing skills.

**Priority: 🟡 Medium** — Broader coverage + quality complement to security skills.

**Additional agents:**

| Task | Notes |
|------|-------|
| Add `cursor` to install scripts | Generates `.cursorrules` |
| Add `windsurf` to install scripts | Generates `.windsurfrules` |
| Add `cline` to install scripts | Generates `.clinerules` |
| Add `aider` to install scripts | Generates `.aider.conf.yml` with `read:` directive |
| Add `continue` to install scripts | Generates `.continue/config.json` snippet |
| `scripts/translate.py` — Translator engine | Reads `AGENT_RULES.md`, outputs all agent files at once |
| GitHub Action: auto-generate on release | Publish IDE files as release assets |

**Optional quality skills:**

| Skill | Tool | Output | Notes |
|-------|------|--------|-------|
| `unit-test` | pytest / jest / go test | Cobertura XML / lcov | Coverage report compatible with SonarQube |
| `quality-scan` | SonarQube Scanner | Code smells, duplication, coverage % | Consumes coverage report from `unit-test` |

```
unit-test (coverage) ──→ quality-scan (SonarQube) ──→ fix-findings
```

**Definition of Done:**
- [ ] All 9 agents supported in install scripts
- [ ] `unit-test` skill generates coverage in Cobertura XML format
- [ ] `quality-scan` skill runs SonarQube Scanner with imported coverage
- [ ] `fix-findings` also accepts SonarQube output
- [ ] CI validates generated files

---

### v1.7 — Agent Governance

> **Goal:** Define HOW agents should behave, not just WHAT code to produce. Inspired by `Baneeishaque/ai-agent-rules`.

**Priority: 🟡 Medium** — Differentiator vs all existing projects.

| Task | Notes |
|------|-------|
| `governance/planning-protocol.md` | Scope definition before implementation, mandatory threat model |
| `governance/permission-protocol.md` | When to ask for human approval (destructive ops, deps, auth changes) |
| `governance/session-docs.md` | Change log per session, decisions record |
| `governance/change-impact.md` | Template for analyzing blast radius of changes |
| Add governance section to `AGENT_RULES.md` | Reference governance files |

**Definition of Done:**
- [ ] Each protocol is self-contained and referenceable from `AGENT_RULES.md`
- [ ] Works with at least Copilot, Codex CLI, Claude CLI, and Antigravity

---

### v1.8 — Advanced Security Policies

> **Goal:** Cover emerging threats and infrastructure security.

**Priority: 🟢 Low** — Important for completeness, not urgency.

| Task | Notes |
|------|-------|
| `policies/post_quantum.yaml` | ML-KEM, ML-DSA, SLH-DSA, hybrid mode guidance |
| `policies/supply_chain.yaml` | SBOM (CycloneDX/SPDX), provenance, reproducible builds |
| `policies/container_security.yaml` | Non-root, image scanning, network policies, secrets as volumes |
| `policies/iac_security.yaml` | Terraform/CloudFormation: no hardcoded creds, encryption-by-default |
| `policies/api_security.yaml` | OWASP API Top 10 2023, GraphQL security |

**Definition of Done:**
- [ ] Each policy is YAML-structured and machine-readable
- [ ] Maps to ≥1 standard (NIST, OWASP, SLSA)
- [ ] CHANGELOG updated

---

## Future (v2.0+)

| Feature | Priority | Notes |
|---------|----------|-------|
| **MCP server config** for security scanning tools | 🟡 | From `lirantal/agent-rules` |
| **Validation suite** — Vulnerable code samples + expected agent output | 🟡 | Test rule effectiveness |
| **GitHub Action** — PR comment with security findings | 🟡 | Enforce policies in CI |
| **VS Code extension** — Auto-detect agent and apply rules | 🟢 | Frictionless setup |
| **Semgrep/CodeQL rules** that validate policy compliance | 🟢 | Bridge to SAST |
| **Optional reference cheat sheets** (`references/python.md`, etc.) | 🟢 | Stack-specific gotchas, loaded on-demand only |

---

## Design Principles

> These guide all roadmap decisions.

1. **Zero dependencies** — Install with `curl` or PowerShell. No Node.js, Python, or Docker required.
2. **One tool per skill** — Each security skill runs exactly one tool and produces one type of finding (CWE ≠ CVE ≠ secret ≠ misconfiguration).
3. **Principle-level rules, not language-specific** — The agent already knows how to apply "parameterized queries" in Python vs Go vs Java. We state the principle + CWE, the agent applies it.
4. **Tiered token profiles** — Standard (~3K tokens) for cloud LLMs, Lite (~1K tokens) for local LLMs. Every addition must justify its token cost. Bloating the context degrades agent quality ("lost in the middle").
5. **Standards-backed** — Every rule maps to OWASP, CWE, NIST, or SLSA. No opinion-based rules without evidence.
6. **Agent-agnostic** — Rules work with any AI agent. IDE-specific format is a translation concern, not a content concern.
7. **Non-destructive** — Install scripts never overwrite existing configuration.

---

## Contributing to the Roadmap

Pick any unchecked item and open a PR. For larger items, open an issue first.

See [CONTRIBUTING.md](CONTRIBUTING.md).
