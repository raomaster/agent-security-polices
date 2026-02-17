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

### v1.3 — More Agents + Translators

> **Goal:** Expand agent support and add a translator engine for auto-generating IDE-specific files.

**Priority: 🔴 High** — Cover more agents and reduce maintenance.

| Task | Notes |
|------|-------|
| Add `cursor` to install scripts | Generates `.cursorrules` |
| Add `windsurf` to install scripts | Generates `.windsurfrules` |
| Add `cline` to install scripts | Generates `.clinerules` |
| Add `aider` to install scripts | Generates `.aider.conf.yml` with `read:` directive |
| Add `continue` to install scripts | Generates `.continue/config.json` snippet |
| `scripts/translate.py` — Translator engine | Reads `AGENT_RULES.md`, outputs all agent files at once |
| GitHub Action: auto-generate on release | Publish IDE files as release assets |

**Definition of Done:**
- [ ] All 9 agents supported in install scripts
- [ ] `./install.sh --all` generates configs for every supported agent
- [ ] CI validates generated files

---

### v1.4 — CLI Tool (optional, npx)

> **Goal:** `npx agent-security-policies` as an alternative for users who have Node.js. Not the primary delivery.

**Priority: 🟢 Low** — Nice to have, curl one-liner is the primary delivery.

| Task | Notes |
|------|-------|
| npm package `agent-security-policies` | Wraps the same logic as install scripts |
| `--profile minimal\|standard\|strict` | Maps to config profiles from README |
| `--list` flag | Show available agents and profiles |
| Interactive mode | Prompt-based selection if no flags |
| Publish to npm | `npx agent-security-policies` works |

---

### v1.5 — Agent Governance

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

### v1.6 — Advanced Security Policies

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
| **Website** — Interactive rule browser + copy-paste wizard | 🟢 | Adoption driver |
| **VS Code extension** — Auto-detect agent and apply rules | 🟢 | Frictionless setup |
| **Badges** — "Secured by agent-security-policies" for READMEs | 🟢 | Community signal |
| **Semgrep/CodeQL rules** that validate policy compliance | 🟢 | Bridge to SAST |
| **Optional reference cheat sheets** (`references/python.md`, etc.) | 🟢 | Stack-specific gotchas, loaded on-demand only |

---

## Design Principles

> These guide all roadmap decisions.

1. **Zero dependencies** — Install with `curl` or PowerShell. No Node.js, Python, or Docker required.
2. **Principle-level rules, not language-specific** — The agent already knows how to apply "parameterized queries" in Python vs Go vs Java. We state the principle + CWE, the agent applies it.
3. **Minimal token footprint** — `AGENT_RULES.md` is ~3K tokens. Every addition must justify its token cost. Bloating the context degrades agent quality ("lost in the middle").
4. **Standards-backed** — Every rule maps to OWASP, CWE, NIST, or SLSA. No opinion-based rules without evidence.
5. **Agent-agnostic** — Rules work with any AI agent. IDE-specific format is a translation concern, not a content concern.
6. **Non-destructive** — Install scripts never overwrite existing configuration.

---

## Contributing to the Roadmap

Pick any unchecked item and open a PR. For larger items, open an issue first.

See [CONTRIBUTING.md](CONTRIBUTING.md).
