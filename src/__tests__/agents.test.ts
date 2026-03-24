import { describe, it, expect } from "vitest";
import {
    SUPPORTED_AGENTS,
    AEGIS_AGENT_CONTENT,
    SKILLS_LIST,
    COMMANDS_LIST,
    PROFILES,
    INSTRUCTIONS_BLOCK,
    POLICY_FILES,
    getAgentById,
    getAllAgentIds,
} from "../agents.js";

describe("SUPPORTED_AGENTS", () => {
    it("includes all 5 expected agents", () => {
        const ids = SUPPORTED_AGENTS.map((a) => a.id);
        expect(ids).toEqual(["copilot", "codex", "claude", "antigravity", "opencode"]);
    });

    it("every agent has required fields", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.id).toBeTruthy();
            expect(agent.name).toBeTruthy();
            expect(agent.description).toBeTruthy();
            expect(agent.configPath).toBeTruthy();
            expect(agent.generateConfig).toBeTypeOf("function");
            expect(agent.skillFormat).toBeDefined();
            expect(agent.commandFormat).toBeDefined();
        }
    });

    it("every agent generates a non-empty config", () => {
        for (const agent of SUPPORTED_AGENTS) {
            const config = agent.generateConfig("test instructions");
            expect(config).toContain("test instructions");
            expect(config.length).toBeGreaterThan(20);
        }
    });
});

describe("OpenCode agent", () => {
    it("exists with correct id", () => {
        const oc = getAgentById("opencode");
        expect(oc).toBeDefined();
        expect(oc!.id).toBe("opencode");
    });

    it("description references oh-my-openagent (not oh-my-opencode)", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.description).toContain("oh-my-openagent");
        expect(oc.description).not.toContain("oh-my-opencode");
    });

    it("config path is .claude/rules/security.md", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.configPath).toBe(".claude/rules/security.md");
    });

    it("creates required directories including .opencode", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.directories).toContain(".opencode");
        expect(oc.directories).toContain(".opencode/skills");
        expect(oc.directories).toContain(".opencode/command");
        expect(oc.directories).toContain(".claude");
        expect(oc.directories).toContain(".claude/rules");
    });

    it("skills use copy format to .opencode/skills/{skill}/SKILL.md", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.skillFormat).toEqual({
            type: "copy",
            destPattern: ".opencode/skills/{skill}/SKILL.md",
        });
    });

    it("commands use copy format to .opencode/command/{command}.md", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.commandFormat).toEqual({
            type: "copy",
            destPattern: ".opencode/command/{command}.md",
        });
    });

    it("has extraPaths for .opencode/agents/", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.extraPaths).toContain(".opencode/agents/");
    });

    it("generates config with YAML frontmatter", () => {
        const oc = getAgentById("opencode")!;
        const config = oc.generateConfig("test");
        expect(config).toMatch(/^---\n/);
        expect(config).toContain("alwaysApply: true");
        expect(config).toContain("OWASP ASVS 5.0.0");
        expect(config).toContain("OWASP Proactive Controls 2024");
    });
});

describe("AEGIS_AGENT_CONTENT", () => {
    it("has valid YAML frontmatter with discipline agent fields", () => {
        expect(AEGIS_AGENT_CONTENT).toMatch(/^---\n/);
        expect(AEGIS_AGENT_CONTENT).toContain("name: Aegis");
        expect(AEGIS_AGENT_CONTENT).toContain("description:");
        expect(AEGIS_AGENT_CONTENT).toContain("model: sonnet");
        expect(AEGIS_AGENT_CONTENT).toContain("mode: all");
        expect(AEGIS_AGENT_CONTENT).toContain("tools:");
    });

    it("includes required tools for security scanning", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("- Bash");
        expect(AEGIS_AGENT_CONTENT).toContain("- Grep");
        expect(AEGIS_AGENT_CONTENT).toContain("- Read");
        expect(AEGIS_AGENT_CONTENT).toContain("- Edit");
        expect(AEGIS_AGENT_CONTENT).toContain("- Write");
    });

    it("references all 8 security skills", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("sast-scan");
        expect(AEGIS_AGENT_CONTENT).toContain("secrets-scan");
        expect(AEGIS_AGENT_CONTENT).toContain("dependency-scan");
        expect(AEGIS_AGENT_CONTENT).toContain("container-scan");
        expect(AEGIS_AGENT_CONTENT).toContain("iac-scan");
        expect(AEGIS_AGENT_CONTENT).toContain("threat-model");
        expect(AEGIS_AGENT_CONTENT).toContain("fix-findings");
        expect(AEGIS_AGENT_CONTENT).toContain("security-review");
    });

    it("references all 3 commands", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("/checkpoint");
        expect(AEGIS_AGENT_CONTENT).toContain("/rollback");
        expect(AEGIS_AGENT_CONTENT).toContain("/security-review");
    });

    it("includes git safety rules", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("Never force push");
        expect(AEGIS_AGENT_CONTENT).toContain("--no-verify");
        expect(AEGIS_AGENT_CONTENT).toContain("Rule 12");
    });
});

describe("getAgentById", () => {
    it("returns agent for valid id", () => {
        expect(getAgentById("copilot")?.name).toBe("GitHub Copilot");
        expect(getAgentById("codex")?.name).toBe("Codex CLI");
        expect(getAgentById("claude")?.name).toBe("Claude CLI");
        expect(getAgentById("antigravity")?.name).toBe("Antigravity");
        expect(getAgentById("opencode")?.name).toBe("OpenCode");
    });

    it("returns undefined for unknown id", () => {
        expect(getAgentById("nonexistent")).toBeUndefined();
        expect(getAgentById("")).toBeUndefined();
    });
});

describe("getAllAgentIds", () => {
    it("returns all 5 agent ids", () => {
        const ids = getAllAgentIds();
        expect(ids).toHaveLength(5);
        expect(ids).toContain("opencode");
    });
});

describe("SKILLS_LIST", () => {
    it("has 8 skills", () => {
        expect(SKILLS_LIST).toHaveLength(8);
    });

    it("each skill has id, tool, description", () => {
        for (const skill of SKILLS_LIST) {
            expect(skill.id).toBeTruthy();
            expect(skill.tool).toBeTruthy();
            expect(skill.description).toBeTruthy();
        }
    });
});

describe("COMMANDS_LIST", () => {
    it("has 3 commands", () => {
        expect(COMMANDS_LIST).toHaveLength(3);
    });

    it("includes checkpoint, rollback, security-review", () => {
        const ids = COMMANDS_LIST.map((c) => c.id);
        expect(ids).toEqual(["security-review", "checkpoint", "rollback"]);
    });
});

describe("PROFILES", () => {
    it("has standard and lite profiles", () => {
        const ids = PROFILES.map((p) => p.id);
        expect(ids).toEqual(["standard", "lite"]);
    });
});

describe("POLICY_FILES", () => {
    it("lists all 6 policy files", () => {
        expect(POLICY_FILES).toHaveLength(6);
        expect(POLICY_FILES).toContain("base_policy.yaml");
        expect(POLICY_FILES).toContain("owasp_asvs.yaml");
        expect(POLICY_FILES).toContain("owasp_proactive_controls.yaml");
    });
});

describe("INSTRUCTIONS_BLOCK", () => {
    it("references key security standards", () => {
        expect(INSTRUCTIONS_BLOCK).toContain("OWASP ASVS 5.0.0");
        expect(INSTRUCTIONS_BLOCK).toContain("CWE/SANS Top 25 2025");
        expect(INSTRUCTIONS_BLOCK).toContain("OWASP Proactive Controls 2024");
    });
});
