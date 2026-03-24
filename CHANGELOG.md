# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.5.6] — 2026-03-24

### Fixed

- Removed `model` field from Aegis agent frontmatter — OpenCode rejects Claude Code shorthands like `sonnet` (`Agent Aegis's configured model sonnet/ is not valid`). Both platforms now use their configured default model.

## [1.5.5] — 2026-03-24

### Fixed

- Removed `tools` array from Aegis agent frontmatter — OpenCode rejects YAML array for `tools` field (`expected record, received array`). Both OpenCode and Claude Code inherit all tools by default when the field is omitted.

## [1.5.4] — 2026-03-24

### Added

- **Agent-driven installation** (`docs/installation.md`) — LLM-readable guide that any agent (Claude Code, Cursor, Windsurf, etc.) can fetch via `curl` and follow to install the correct configuration automatically
- README now shows the "For Humans / For LLM Agents" install pattern at the top — paste one prompt to your agent and it handles everything
- `docs/` directory included in npm package `files`

## [1.5.3] — 2026-03-24

### Fixed

- `detectOhMyOpenagent()` now probes `oh-my-openagent.json[c]` (new filename after project rename) — users who migrated to the new name were never detected, causing Aegis prompt to be skipped silently
- `detectOhMyOpenagent()` strips trailing commas before `JSON.parse` — valid JSONC files with trailing commas were silently treated as malformed
- `detectOhMyOpenagent()` falls through to remaining config paths when a file exists but has no plugin entry — plugin declared in `opencode.json` was masked by a sibling `oh-my-openagent.jsonc` with agent settings
- `getOmoConfigPaths()` expanded from 3 to 6 paths: `oh-my-openagent.jsonc`, `oh-my-openagent.json`, `oh-my-opencode.jsonc`, `oh-my-opencode.json`, `opencode.jsonc`, `opencode.json`
- Tests: 172 (+8 covering all 3 bug scenarios)

## [1.5.2] — 2026-03-23

### Added

- **Aegis for Claude Code** — `--aegis` flag installs Aegis as a `.claude/agents/` subagent, enabling isolated on-demand security review without bloating the main conversation context
  - `claude --agent aegis` makes Aegis the primary agent for a full session (session-wide coverage)
  - `.claude/agents/aegis.md` — Claude Code subagent with description-based auto-delegation
- **`--aegis` CLI flag** — installs Aegis for any selected agent: `.claude/agents/aegis.md` for `claude`, `.opencode/agents/aegis.md` for `opencode` (without `--omo`)
- Interactive mode now asks about Aegis for Claude Code when `claude` agent is selected
- `installAegisAgent(targetDir, agentId)` accepts agent ID to route to correct path

### Changed

- `installAegisAgent()` now accepts `agentId: "opencode" | "claude"` parameter — OpenCode path unchanged (`.opencode/agents/aegis.md`)
- `InstallOptions` gains `aegis: boolean` field
- README: added complete Claude Code CLI section (was missing), layered security model explanation, Aegis comparison table (OpenCode `mode: all` vs Claude Code on-demand delegation)
- Version badge updated to 1.5.2

### Fixed

- Aegis install path for OpenCode corrected to `.opencode/agents/aegis.md` (was `.claude/agents/` which is Claude Code's convention, not OpenCode's)
- Test count: 164 tests (+6), all thresholds >80% (branches: 82.86%)

## [1.5.1] — 2026-03-23

### Added

- **Test suite** — 158 tests across 6 files, 80%+ coverage on all thresholds (Vitest + V8)
  - `src/__tests__/agents.test.ts` — full coverage of agent configs, AEGIS_AGENT_CONTENT, skills, commands, profiles
  - `src/__tests__/installer.test.ts` — `stripJsonComments`, `stripYamlFrontmatter`, `detectOhMyOpenagent`, `install()` end-to-end for all 5 agents
  - `src/__tests__/installer-confirm.test.ts` — `confirmAppend` flow with readline mock
  - `src/__tests__/cli.test.ts` — `parseArgs` (all flags and combinations), `showUsage`, `showList`
  - `src/__tests__/prompts.test.ts` — `interactiveMode` with readline mock, all branches covered (100% branch coverage)
  - `src/__tests__/integration.test.ts` — naming conventions, OmO discipline agent format, cross-agent compatibility
- `vitest.config.ts` — coverage config with 80% global thresholds (lines, branches, functions, statements), LCOV reporter for SonarQube/Codecov
- `stripJsonComments()` exported from `installer.ts` — state-machine JSONC parser (handles `//`, `/* */`, preserves strings)
- `getOmoConfigPaths(homeDir?)` exported from `installer.ts` — testable config path resolution with optional homeDir injection
- `stripYamlFrontmatter()` exported from `installer.ts` — previously private
- `parseArgs()`, `showUsage()`, `showList()` exported from `cli.ts` — enables unit testing
- `test`, `test:watch`, `test:coverage` scripts in `package.json`
- `@vitest/coverage-v8` devDependency
- `oh-my-openagent` keyword in `package.json`

### Changed

- **oh-my-opencode → oh-my-openagent** — project was renamed upstream; all references updated across `src/`, `install.sh`, `install.ps1`, `README.md`, `CHANGELOG.md`, `ROADMAP.md`
- `detectOhMyOpenagent()` replaces `detectOhMyOpencode()` with:
  - JSONC support (JSON with comments, the new OmO config format)
  - Checks 3 config paths in priority order: `oh-my-opencode.jsonc` → `oh-my-opencode.json` → `opencode.json` (legacy)
  - Supports both `"plugin"` key (new OmO standard) and `"plugins"` key (legacy)
  - Detects both `"oh-my-openagent"` and legacy `"oh-my-opencode"` plugin strings
  - Optional `homeDir` parameter for dependency injection in tests
- `detectOhMyOpencode()` kept as a deprecated alias for backward compatibility
- `src/__tests__/` excluded from TypeScript compilation (`tsconfig.json`)

## [1.5.0] — 2026-03-18

### Added

- OpenCode agent support (vanilla + oh-my-openagent enhanced mode via `--omo`)
- Aegis security agent (`.claude/agents/aegis.md`) — specialized subagent with `mode: all`, installed when `--omo` is active
- `skills/security-review/` — 8th skill, no Docker required, 3-phase methodology (static analysis → dependency check → secrets scan)
- `commands/security-review.md` — user-invocable `/security-review` command
- `commands/checkpoint.md` — create labeled git stash before risky operations
- `commands/rollback.md` — revert to a named checkpoint
- `policies/owasp_proactive_controls.yaml` — OWASP Proactive Controls 2024 (C1-C10)
- Rule 12: Git Safety Protocol in `AGENT_RULES.md`
- `--gitignore` support in `install.sh` and `install.ps1`
- `--omo` / `-Omo` flag in CLI, `install.sh`, and `install.ps1`
- `commandFormat` field in `AgentConfig` for per-agent command installation
- `extraPaths` field in `AgentConfig` for additional `.gitignore` entries
- `detectOhMyOpencode()` exported from `installer.ts`
- `COMMANDS_LIST` exported from `agents.ts`
- `opencode` keyword in `package.json`
- `commands/` directory added to npm package `files` list

## [1.4.2] — 2026-03-05

### Changed

- `--help` now shows default values for `--skills`, `--profile`, `--gitignore`
- README: "Configuration Profiles" renamed to "Enforcement Levels" — clarifies these are manual instruction snippets independent of `--profile` (which controls token budget)
- README: reordered Quick Install examples — interactive mode is now listed second after `--all`

## [1.4.1] — 2026-03-05

### Added

- `--gitignore` CLI flag — adds all installed files to `.gitignore` with idempotent comment markers (`# >>> agent-security-policies >>>` / `# <<< agent-security-policies <<<`)
- Interactive mode now asks "Add installed files to .gitignore?" (default: No)
- Pre-install safety check — when existing agent config files are detected (e.g. `CLAUDE.md`, `AGENTS.md`), the installer shows a notice explaining that content will be appended (not replaced) and asks for confirmation before proceeding

### Changed

- `install()` is now async to support the interactive confirmation prompt
- `printSummary()` shows "Commit the updated .gitignore" when `--gitignore` is active

## [1.4.0] — 2026-03-03

### Added

- `npx agent-security-policies` CLI tool — cross-platform TypeScript installer, zero runtime dependencies
  - `--all` — install for all supported agents + security skills
  - `--agent <list>` — comma-separated agent selection (copilot, codex, claude, antigravity)
  - `--skills` — install security skills pack
  - `--profile standard|lite` — select token-optimized rule profile
  - `--target <dir>` — install to a specific project directory
  - `--list` — show available agents, profiles, and skills
  - Interactive mode when invoked with no flags
- `package.json`, `tsconfig.json`, `src/` — TypeScript CLI source (Node.js 18+)

### Changed

- `README.md` — added `npx` as the recommended (cross-platform) install method in Quick Install

## [Unreleased]

### Added

- `skills/README.md` — Skills Design and Creation Guide: anatomy of a `SKILL.md`, step-by-step process to add new skills, design principles (zero deps, one tool per skill, agent-agnostic)

### Changed

- `install.sh` and `install.ps1` — `--all` / `-All` now also install security skills to satisfy roadmap v1.3 delivery flow
- `README.md` — professional rewrite: shields.io badges, stronger value proposition, full Table of Contents, `## Agent Setup` section grouping all 10 agents as `###` sub-headings, Skills table with tool/output columns, Lite profile, Contributing and License footer sections
- `README.md` — fixed heading "método universal" → "universal method"
- `README.md` — Quick Install now documents that `--all` includes the skills pack by default
- `CONTRIBUTING.md` — added section 3 "Add or Improve Security Skills" with link to `skills/README.md`; sections renumbered to maintain correct order (1–5)
- `ROADMAP.md` — v1.3 (`Security Skills`) moved to Completed with deliverables marked as implemented

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
