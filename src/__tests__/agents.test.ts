import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import {
    SUPPORTED_AGENTS,
    AEGIS_AGENT_CONTENT,
    SKILLS_LIST,
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
            // commandFormat removed — skills cover all agent instructions
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
        expect(AEGIS_AGENT_CONTENT).toContain("mode: all");
        // tools field intentionally omitted — OpenCode rejects YAML arrays for tools
        // both OpenCode and Claude Code inherit all tools by default
        expect(AEGIS_AGENT_CONTENT).not.toContain("tools:");
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

    it("references checkpoint and rollback skills", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("checkpoint");
        expect(AEGIS_AGENT_CONTENT).toContain("rollback");
    });

    it("includes git safety rules", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("Never force push");
        expect(AEGIS_AGENT_CONTENT).toContain("--no-verify");
        expect(AEGIS_AGENT_CONTENT).toContain("Rule 12");
    });
});

describe("AgentConfig — global fields", () => {
    it("every agent has globalDir function", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.globalDir).toBeTypeOf("function");
            const dir = agent.globalDir(os.homedir());
            expect(dir).toBeTruthy();
            expect(path.isAbsolute(dir)).toBe(true);
        }
    });

    it("every agent has globalConfigPath string", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.globalConfigPath).toBeTypeOf("string");
            expect(agent.globalConfigPath.length).toBeGreaterThan(0);
        }
    });

    it("every agent has globalSkillFormat", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.globalSkillFormat).toBeDefined();
            expect(["copy", "strip-frontmatter", "append", "none"]).toContain(
                agent.globalSkillFormat.type
            );
        }
    });

    it("every agent has detect function", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.detect).toBeTypeOf("function");
        }
    });

    it("claude globalDir resolves to ~/.claude", () => {
        const claude = getAgentById("claude")!;
        expect(claude.globalDir("/home/testuser")).toBe("/home/testuser/.claude");
    });

    it("codex globalDir resolves to ~/.codex", () => {
        const codex = getAgentById("codex")!;
        expect(codex.globalDir("/home/testuser")).toBe("/home/testuser/.codex");
    });

    it("opencode globalDir resolves to ~/.config/opencode", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.globalDir("/home/testuser")).toBe("/home/testuser/.config/opencode");
    });

    it("antigravity globalDir resolves to ~/.agent", () => {
        const ag = getAgentById("antigravity")!;
        expect(ag.globalDir("/home/testuser")).toBe("/home/testuser/.agent");
    });

    it("copilot globalDir resolves to ~/.github", () => {
        const cp = getAgentById("copilot")!;
        expect(cp.globalDir("/home/testuser")).toBe("/home/testuser/.github");
    });
});

describe("AgentConfig — detect()", () => {
    it("claude detect returns true when ~/.claude exists", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-test-"));
        const homeDir = path.join(tmpDir, "home");
        fs.mkdirSync(path.join(homeDir, ".claude"), { recursive: true });
        try {
            const claude = getAgentById("claude")!;
            expect(claude.detect(homeDir)).toBe(true);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("claude detect returns false when not found", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-test-"));
        const homeDir = path.join(tmpDir, "home");
        fs.mkdirSync(homeDir, { recursive: true });
        try {
            const claude = getAgentById("claude")!;
            expect(claude.detect(homeDir)).toBe(false);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("detect never throws for copilot when .vscode is a file (readdirSync would fail)", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-test-"));
        const homeDir = path.join(tmpDir, "home");
        fs.mkdirSync(homeDir, { recursive: true });
        // Create .vscode as a file, not a directory, so readdirSync throws ENOTDIR
        fs.writeFileSync(path.join(homeDir, ".vscode"), "not a dir");
        try {
            const copilot = getAgentById("copilot")!;
            expect(() => copilot.detect(homeDir)).not.toThrow();
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("detect never throws for standard agents with an unusual path", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(() => agent.detect("/home/testuser/nonexistent/path")).not.toThrow();
        }
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
    it("has 10 skills", () => {
        expect(SKILLS_LIST).toHaveLength(10);
    });

    it("includes checkpoint and rollback", () => {
        const ids = SKILLS_LIST.map((s) => s.id);
        expect(ids).toContain("checkpoint");
        expect(ids).toContain("rollback");
    });

    it("each skill has id, tool, description", () => {
        for (const skill of SKILLS_LIST) {
            expect(skill.id).toBeTruthy();
            expect(skill.tool).toBeTruthy();
            expect(skill.description).toBeTruthy();
        }
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
