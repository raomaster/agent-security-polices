# TODO — Roadmap

> Features and improvements to incorporate, prioritized by impact.

## v1.0 — Current (Ready to Ship) ✅

- [x] `AGENT_RULES.md` — Main system prompt (10 standards, 11 rule domains)
- [x] `README.md` — Setup instructions for 10 agents/IDEs
- [x] `policies/base_policy.yaml` — 11 security domains
- [x] `policies/owasp_asvs.yaml` — ASVS 5.0.0 checklist (V1-V17)
- [x] `policies/cwe_top25.yaml` — CWE/SANS Top 25 2025
- [x] `policies/llm_security.yaml` — OWASP LLM Top 10 2025
- [x] CWE mapping with prevention guidance
- [x] ASVS audit checklist with severity scoring + verdicts
- [x] STRIDE threat modeling template
- [x] Standards reference table with links

## v1.1 — Repo Essentials

- [x] `LICENSE` (Apache-2.0)
- [x] `CONTRIBUTING.md` — How to add rules, policies, and translations
- [x] `CHANGELOG.md` — Version history
- [x] `CODE_OF_CONDUCT.md`
- [x] `.gitignore`
- [x] GitHub Issue templates (new rule, new policy, bug)
- [x] GitHub PR template

## v1.2 — Competitive Parity (from `continuedev/awesome-rules`)

- [ ] **Frontmatter format** — Add YAML frontmatter to rules (amplified.dev compatible)
  ```yaml
  ---
  name: input-validation
  description: OWASP ASVS V5 input validation rules
  category: security
  standards: [ASVS-V5, CWE-20]
  languages: [all]
  ---
  ```
- [ ] **Rules by language** — Language-specific security rules
  - [ ] `rules/python/` — Python-specific (bandit rules, pickle, eval, subprocess)
  - [ ] `rules/typescript/` — TS-specific (strict mode, any avoidance, prototype pollution)
  - [ ] `rules/go/` — Go-specific (error handling, goroutine leaks, crypto/rand)
  - [ ] `rules/rust/` — Rust-specific (unsafe blocks, memory management)
  - [ ] `rules/java/` — Java-specific (OWASP ESAPI, Spring Security)
  - [ ] `rules/csharp/` — C#-specific (.NET security, LINQ injection)
- [ ] **Rules by framework** — Framework-specific security rules
  - [ ] `rules/react/` — XSS prevention, dangerouslySetInnerHTML
  - [ ] `rules/nextjs/` — SSR security, API routes, middleware
  - [ ] `rules/fastapi/` — Dependency injection, Pydantic validation
  - [ ] `rules/express/` — Helmet, CORS, rate limiting
  - [ ] `rules/django/` — ORM injection, CSRF, template escaping
  - [ ] `rules/spring/` — Spring Security, actuator lockdown

## v1.3 — IDE Translators (from `cosai-oasis/project-codeguard`)

- [ ] **Canonical source format** — `sources/` directory with unified rules
- [ ] **Translator scripts** — Auto-convert to IDE-specific formats:
  - [ ] `.cursorrules` generator
  - [ ] `.github/copilot-instructions.md` generator
  - [ ] `.windsurfrules` generator
  - [ ] `.clinerules` generator
  - [ ] `.gemini/settings.json` generator
  - [ ] `CLAUDE.md` generator
- [ ] **GitHub Action** — Auto-generate IDE files on release

## v1.4 — CLI Tool (from `lirantal/agent-rules`)

- [ ] **`npx agent-security-policies`** — Interactive scaffold CLI
  - [ ] `--agent <name>` — Select target agent (cursor, copilot, claude, etc.)
  - [ ] `--lang <language>` — Include language-specific rules
  - [ ] `--framework <name>` — Include framework-specific rules
  - [ ] `--strict` — Include all policies (ASVS + CWE + LLM)
  - [ ] `--minimal` — Base policy only
  - [ ] Non-destructive merge with existing config files
- [ ] Publish to npm as `agent-security-policies`

## v1.5 — Agent Governance (from `Baneeishaque/ai-agent-rules`)

- [ ] **Planning protocol** — How the agent must plan before coding
  - [ ] Require scope definition before implementation
  - [ ] Mandatory threat model for new features
  - [ ] Change impact analysis template
- [ ] **Permission protocol** — When the agent must ask for human approval
  - [ ] Destructive operations (delete, overwrite, deploy)
  - [ ] External API calls or network requests
  - [ ] Dependency additions
  - [ ] Security-sensitive changes (auth, crypto, access control)
- [ ] **Session documentation** — How the agent tracks its work
  - [ ] Change log per session
  - [ ] Decisions record with rationale
  - [ ] Security review summary

## v1.6 — Advanced Security

- [ ] **Post-quantum cryptography** (from `cosai-oasis/project-codeguard`)
  - [ ] Add ML-KEM, ML-DSA, SLH-DSA to crypto recommendations
  - [ ] Hybrid mode guidance (classical + PQC)
- [ ] **Supply chain deep-dive** — Extended SLSA rules
  - [ ] SBOM generation requirements (CycloneDX/SPDX)
  - [ ] Dependency provenance verification
  - [ ] Reproducible builds guidance
- [ ] **Container security** — Docker/K8s rules
  - [ ] Non-root containers
  - [ ] Image scanning
  - [ ] Network policies
  - [ ] Secrets as mounted volumes, not env vars
- [ ] **IaC security** — Terraform/CloudFormation rules
  - [ ] No hardcoded credentials in IaC
  - [ ] Encryption at rest enabled by default
  - [ ] Public access blocked by default

## v2.0 — Ecosystem

- [ ] **MCP integration** (from `lirantal/agent-rules`)
  - [ ] MCP server config for security scanning tools
  - [ ] Auto-configure `.vscode/mcp.json` and `.gemini/settings.json`
- [ ] **Validation suite** — Test that rules work correctly
  - [ ] Vulnerable code samples (intentionally insecure)
  - [ ] Expected agent output for each sample
  - [ ] CI that tests rules against multiple agents
- [ ] **Metrics dashboard** — Track adoption
  - [ ] GitHub stars, forks, clones
  - [ ] npm downloads (once CLI published)
  - [ ] Community contributions per month
- [ ] **Website** — `agent-security-policies.dev` or similar
  - [ ] Interactive rule browser
  - [ ] Copy-paste setup wizard
  - [ ] Badge for repos using the rules

## Ideas Parking Lot

- [ ] VS Code extension that auto-detects agent and applies rules
- [ ] GitHub App that comments on PRs with security findings based on rules
- [ ] Slack/Discord bot for community
- [ ] Integration with SAST tools (Semgrep, CodeQL) for rule validation
- [ ] AI-generated compliance reports based on which rules are active
- [ ] Rule effectiveness scoring (which rules catch the most issues)
