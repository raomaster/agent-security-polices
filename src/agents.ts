// src/agents.ts — Agent configuration definitions

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface AgentConfig {
    /** Display name */
    name: string;
    /** CLI flag value */
    id: string;
    /** Description shown in --list and interactive mode */
    description: string;
    /** Relative path to the config file (from target directory) */
    configPath: string;
    /** Generate the config file content */
    generateConfig: (instructions: string) => string;
    /** Directories to create before writing config */
    directories: string[];
    /** Skill installation config */
    skillFormat: SkillFormat;
    /** Extra paths to add to .gitignore (beyond configPath and skill dirs) */
    extraPaths?: string[];
    /** Absolute path to the agent's global config directory. */
    globalDir: (homeDir: string) => string;
    /** Config file path relative to globalDir. */
    globalConfigPath: string;
    /** Skill installation paths relative to globalDir. */
    globalSkillFormat: SkillFormat;
    /** Directories to create inside globalDir before installing. */
    globalDirectories: string[];
    /** Returns true if this agent appears to be installed on this machine. Never throws. */
    detect: (homeDir?: string) => boolean;
}

export type SkillFormat =
    | { type: "copy"; destPattern: string }       // e.g. .agent/skills/{skill}/SKILL.md
    | { type: "strip-frontmatter"; destPattern: string }  // e.g. .claude/commands/{skill}.md
    | { type: "append"; destFile: string }         // e.g. append to AGENTS.md
    | { type: "none" };

/**
 * Generate Aegis agent frontmatter + body.
 * @param model  Optional model string to embed in frontmatter.
 *               - OpenCode: full provider/model-id (e.g. "anthropic/claude-sonnet-4-6")
 *               - Claude Code: shorthand (e.g. "sonnet")
 *               - Omit to let the platform use its configured default.
 */
export function generateAegisContent(model?: string): string {
    const modelLine = model ? `model: ${model}\n` : "";
    return `---
name: Aegis
description: Security specialist agent. Runs security scans, reviews code for vulnerabilities, applies OWASP/CWE/NIST standards, and fixes findings. Delegate security-related tasks here.
${modelLine}mode: all
---

# Aegis — Security Specialist Agent

You are **Aegis**, a security specialist AI agent built on \`agent-security-policies\`.

## Your Mission

Systematically find and fix security vulnerabilities in code, infrastructure, and AI agent behavior. Enforce OWASP, CWE/SANS, NIST, and Proactive Controls standards on every task.

## Skills Available

| Skill | Type | Purpose |
|-------|------|---------|
| \`sast-scan\` | Tool | CWE-mapped code vulnerabilities |
| \`secrets-scan\` | Tool | Hardcoded credentials |
| \`dependency-scan\` | Tool | Known CVEs in packages |
| \`container-scan\` | Tool | Container image misconfigurations |
| \`iac-scan\` | Tool | Terraform/Helm/K8s issues |
| \`threat-model\` | Agent | STRIDE threat modeling |
| \`fix-findings\` | Agent | Automated fixes from any scan output |
| \`security-review\` | Agent+Tools | Full review: agent analysis + all scans |
| \`checkpoint\` | Agent | Create safety stash before risky changes |
| \`rollback\` | Agent | Revert to a previous checkpoint |

## Working Method

1. Read AGENT_RULES.md before any task
2. Suggest /checkpoint to the user when the task involves large-scale refactoring, auth/crypto changes, schema migrations, or mass file deletions — never auto-invoke for routine tasks
3. Select skill(s) for the request
4. Execute following SKILL.md instructions
5. Triage: CRITICAL → HIGH → MEDIUM → LOW → INFO
6. Apply fixes with fix-findings skill
7. Re-scan to verify
8. Report with CWE/CVE/OWASP mapping

## Git Safety Rules

Never force push. Never --no-verify. Never \`git add -A\` blindly. Never modify git config. Never commit .env. Prefer new commits over --amend. See Rule 12 in AGENT_RULES.md.
`;
}

/** Default Aegis content with no model — for backwards compatibility and tests */
export const AEGIS_AGENT_CONTENT = generateAegisContent();

export const SUPPORTED_AGENTS: AgentConfig[] = [
    {
        id: "copilot",
        name: "GitHub Copilot",
        description: "VS Code + JetBrains",
        configPath: ".github/copilot-instructions.md",
        directories: [".github"],
        generateConfig: (instructions) =>
            `# Security Policy Instructions\n\n${instructions}\n`,
        skillFormat: {
            type: "strip-frontmatter",
            destPattern: ".github/prompts/{skill}.prompt.md",
        },
        globalDir: (h) => path.join(h, ".github"),
        globalConfigPath: "copilot-instructions.md",
        globalSkillFormat: { type: "strip-frontmatter", destPattern: "prompts/{skill}.prompt.md" },
        globalDirectories: ["prompts"],
        detect: (h = os.homedir()) => {
            try {
                if (fs.existsSync(path.join(h, ".github", "copilot-instructions.md"))) return true;
                const extDir = path.join(h, ".vscode", "extensions");
                if (!fs.existsSync(extDir)) return false;
                return fs.readdirSync(extDir).some((d) => d.startsWith("github.copilot"));
            } catch { return false; }
        },
    },
    {
        id: "codex",
        name: "Codex CLI",
        description: "OpenAI",
        configPath: "AGENTS.md",
        directories: [],
        generateConfig: (instructions) =>
            `# Project Agent Instructions\n\n## Security Policy\n\n${instructions}\n`,
        skillFormat: { type: "append", destFile: "AGENTS.md" },
        globalDir: (h) => path.join(h, ".codex"),
        globalConfigPath: "AGENTS.md",
        globalSkillFormat: { type: "copy", destPattern: "skills/{skill}/SKILL.md" },
        globalDirectories: ["skills"],
        detect: (h = os.homedir()) => {
            try { return fs.existsSync(path.join(h, ".codex")); } catch { return false; }
        },
    },
    {
        id: "claude",
        name: "Claude CLI",
        description: "Anthropic",
        configPath: "CLAUDE.md",
        directories: [],
        generateConfig: (instructions) =>
            `# Project Instructions\n\n## Security Policy\n\n${instructions}\n`,
        skillFormat: {
            type: "strip-frontmatter",
            destPattern: ".claude/commands/{skill}.md",
        },
        globalDir: (h) => path.join(h, ".claude"),
        globalConfigPath: "CLAUDE.md",
        globalSkillFormat: { type: "strip-frontmatter", destPattern: "commands/{skill}.md" },
        globalDirectories: ["commands"],
        detect: (h = os.homedir()) => {
            try { return fs.existsSync(path.join(h, ".claude")); } catch { return false; }
        },
    },
    {
        id: "antigravity",
        name: "Antigravity",
        description: "Google Gemini",
        configPath: ".agent/rules/security.md",
        directories: [".agent", ".agent/rules"],
        generateConfig: (instructions) =>
            `---\ndescription: Security policy — OWASP ASVS, CWE Top 25, NIST SSDF\nalwaysApply: true\n---\n\n${instructions}\n`,
        skillFormat: {
            type: "copy",
            destPattern: ".agent/skills/{skill}/SKILL.md",
        },
        globalDir: (h) => path.join(h, ".agent"),
        globalConfigPath: "rules/security.md",
        globalSkillFormat: { type: "copy", destPattern: "skills/{skill}/SKILL.md" },
        globalDirectories: ["rules", "skills"],
        detect: (h = os.homedir()) => {
            try { return fs.existsSync(path.join(h, ".agent")); } catch { return false; }
        },
    },
    {
        id: "opencode",
        name: "OpenCode",
        description: "AI coding agent (oh-my-openagent compatible)",
        configPath: ".claude/rules/security.md",
        directories: [".claude", ".claude/rules", ".opencode", ".opencode/skills", ".opencode/command", ".opencode/agents"],
        generateConfig: (instructions) =>
            `---\ndescription: Security policy — OWASP ASVS 5.0.0, CWE Top 25 2025, NIST SSDF, OWASP Proactive Controls 2024\nalwaysApply: true\n---\n\n${instructions}\n`,
        skillFormat: {
            type: "copy",
            destPattern: ".opencode/skills/{skill}/SKILL.md",
        },
        extraPaths: [".opencode/agents/"],
        globalDir: (h) => path.join(h, ".config", "opencode"),
        globalConfigPath: "rules/security.md",
        globalSkillFormat: { type: "copy", destPattern: "skills/{skill}/SKILL.md" },
        globalDirectories: ["rules", "skills", "agents", "command"],
        detect: (h = os.homedir()) => {
            try { return fs.existsSync(path.join(h, ".config", "opencode")); } catch { return false; }
        },
    },
];

export const SKILLS_LIST = [
    { id: "sast-scan",        tool: "Semgrep", description: "CWE code vulnerabilities" },
    { id: "secrets-scan",     tool: "Gitleaks", description: "Hardcoded credentials" },
    { id: "dependency-scan",  tool: "Trivy", description: "CVE in dependencies" },
    { id: "container-scan",   tool: "Trivy", description: "CVE in containers" },
    { id: "iac-scan",         tool: "Trivy", description: "IaC misconfigurations" },
    { id: "threat-model",     tool: "Agent", description: "STRIDE threat modeling" },
    { id: "security-review",  tool: "Agent+Tools", description: "Full review: agent analysis + all scans" },
    { id: "fix-findings",     tool: "Agent", description: "Remediate scan findings" },
    { id: "checkpoint",       tool: "Agent", description: "Create labeled git stash checkpoint" },
    { id: "rollback",         tool: "Agent", description: "Revert to a previous checkpoint" },
];

export const PROFILES = [
    { id: "standard", description: "Full rules (~3K tokens)", file: "AGENT_RULES.md" },
    { id: "lite", description: "Compact rules (~1K tokens)", file: "AGENT_RULES_LITE.md" },
];

export const INSTRUCTIONS_BLOCK = `Follow ALL security and code quality rules defined in AGENT_RULES.md.

Key mandatory rules:
- Apply OWASP ASVS 5.0.0 verification checklist to every change
- Prevent all CWE/SANS Top 25 2025 weaknesses
- Use typed exceptions — never bare except
- Never hardcode secrets (CWE-798)
- Validate all inputs at trust boundaries (CWE-20)
- shell=False in subprocess calls (CWE-78)
- Parameterized queries only — never concatenate SQL (CWE-89)
- Type hints + docstrings on all public APIs
- Structured logging with correlation IDs
- STRIDE threat model for new features
- Apply OWASP Proactive Controls 2024 (C1-C10) to every new feature

Reference policies/ for detailed YAML security rulesets:
- policies/base_policy.yaml — 11 security domains
- policies/owasp_asvs.yaml — ASVS 5.0.0 (V1-V17)
- policies/cwe_top25.yaml — CWE/SANS Top 25 2025
- policies/llm_security.yaml — OWASP LLM Top 10 2025
- policies/owasp_proactive_controls.yaml — OWASP Proactive Controls 2024 (C1-C10)`;

export const POLICY_FILES = [
    "base_policy.yaml",
    "owasp_asvs.yaml",
    "owasp_masvs.yaml",
    "cwe_top25.yaml",
    "llm_security.yaml",
    "owasp_proactive_controls.yaml",
];

export function getAgentById(id: string): AgentConfig | undefined {
    return SUPPORTED_AGENTS.find((a) => a.id === id);
}

export function getAllAgentIds(): string[] {
    return SUPPORTED_AGENTS.map((a) => a.id);
}
