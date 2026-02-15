# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] — 2026-02-15

### Changed

- `README.md` — canonical delivery model changed to repo-root paths (`AGENT_RULES.md`, `policies/`) with explicit delivery options
- `README.md` — added MASVS policy in contents and mobile scope guidance
- `AGENT_RULES.md` — ASVS references aligned to 5.0.0 with V1-V17 checklist
- `policies/owasp_asvs.yaml` — replaced old V1-V14 structure with ASVS 5.0.0-aligned V1-V17 categories
- `TODO.md` — ASVS checklist entry updated to V1-V17

### Added

- `policies/owasp_masvs.yaml` — OWASP MASVS 2.1.0 control checklist for mobile applications

## [1.0.0] — 2025-02-14

### Added

- `AGENT_RULES.md` — Main system prompt covering 10 industry standards
  - 11 mandatory security rule domains
  - Code quality requirements
  - STRIDE threat modeling template
  - OWASP ASVS 5.0 audit checklist (V1-V14)
  - Severity scoring (CRITICAL → INFO) with verdict criteria
  - CWE/SANS Top 25 2025 quick reference table
  - Standards reference with links
- `README.md` — Setup instructions for 10 AI agents/IDEs
  - GitHub Copilot (VS Code + JetBrains)
  - Cursor
  - Windsurf
  - Claude (Projects + API)
  - ChatGPT / GPT API
  - Gemini Code Assist / Antigravity
  - Cline / Roo Code
  - Aider
  - Continue.dev
  - OpenCode / PEA Engine
- `policies/base_policy.yaml` — 11 security domains with rules
- `policies/owasp_asvs.yaml` — ASVS 5.0 chapter-by-chapter checklist
- `policies/cwe_top25.yaml` — All 25 CWE/SANS 2025 entries with prevention
- `policies/llm_security.yaml` — OWASP LLM Top 10 2025 controls
- `CONTRIBUTING.md` — Contribution guidelines
- `LICENSE` — Apache 2.0
- `TODO.md` — Public roadmap
