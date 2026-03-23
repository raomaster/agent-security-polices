/**
 * Integration tests covering cross-cutting concerns:
 * naming conventions, cross-agent compatibility, and
 * OmO discipline agent format validation.
 */
import { describe, it, expect } from "vitest";
import { SUPPORTED_AGENTS, AEGIS_AGENT_CONTENT, getAgentById } from "../agents.js";

// ─── Naming: no oh-my-opencode leaks ────────────────────────────────

describe("no oh-my-opencode naming leaks", () => {
    it("OpenCode agent description uses oh-my-openagent", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.description).toContain("oh-my-openagent");
        expect(oc.description).not.toContain("oh-my-opencode");
    });

    it("no SUPPORTED_AGENTS description mentions oh-my-opencode", () => {
        for (const agent of SUPPORTED_AGENTS) {
            expect(agent.description).not.toContain("oh-my-opencode");
        }
    });
});

// ─── OmO discipline agent format ────────────────────────────────────

describe("Aegis OmO discipline agent format", () => {
    it("starts with YAML frontmatter block", () => {
        expect(AEGIS_AGENT_CONTENT).toMatch(/^---\n/);
    });

    it("frontmatter contains all discipline agent required fields", () => {
        const lines = AEGIS_AGENT_CONTENT.split("\n");
        const endIdx = lines.findIndex((l, i) => i > 0 && l === "---");
        const frontmatter = lines.slice(1, endIdx).join("\n");

        expect(frontmatter).toContain("name:");
        expect(frontmatter).toContain("description:");
        expect(frontmatter).toContain("model:");
        expect(frontmatter).toContain("mode:");
        expect(frontmatter).toContain("tools:");
    });

    it("mode is 'all' (active on every task)", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("mode: all");
    });

    it("model is 'sonnet' (capable but not ultrabrain)", () => {
        expect(AEGIS_AGENT_CONTENT).toContain("model: sonnet");
    });

    it("installed to .claude/agents/ — OmO standard location", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.extraPaths).toContain(".claude/agents/");
    });
});

// ─── Cross-agent compatibility ───────────────────────────────────────

describe("cross-agent skill format compatibility", () => {
    it("copy format agents produce paths with SKILL.md", () => {
        const copyAgents = SUPPORTED_AGENTS.filter(
            (a) => a.skillFormat.type === "copy"
        );
        expect(copyAgents.length).toBeGreaterThanOrEqual(2);

        for (const agent of copyAgents) {
            if (agent.skillFormat.type !== "copy") continue;
            const dest = agent.skillFormat.destPattern.replace("{skill}", "test-skill");
            expect(dest).toContain("test-skill");
            expect(dest).toContain("SKILL.md");
        }
    });

    it("strip-frontmatter agents produce paths without SKILL.md", () => {
        const stripped = SUPPORTED_AGENTS.filter(
            (a) => a.skillFormat.type === "strip-frontmatter"
        );
        for (const agent of stripped) {
            if (agent.skillFormat.type !== "strip-frontmatter") continue;
            const dest = agent.skillFormat.destPattern.replace("{skill}", "test-skill");
            expect(dest).toContain("test-skill");
            expect(dest).not.toContain("SKILL.md");
        }
    });

    it("only opencode agent has commands + skills + extraPaths (most capable)", () => {
        const oc = getAgentById("opencode")!;
        expect(oc.commandFormat.type).not.toBe("none");
        expect(oc.skillFormat.type).not.toBe("none");
        expect(oc.extraPaths).toBeDefined();
        expect(oc.extraPaths!.length).toBeGreaterThan(0);
    });

    it("OpenCode uses .opencode/ prefix (not .claude/) for skills and commands", () => {
        const oc = getAgentById("opencode")!;
        if (oc.skillFormat.type === "copy") {
            expect(oc.skillFormat.destPattern).toMatch(/^\.opencode\//);
        }
        if (oc.commandFormat.type === "copy") {
            expect(oc.commandFormat.destPattern).toMatch(/^\.opencode\//);
        }
    });

    it("OpenCode config is in .claude/rules/ (OmO auto-discovery location)", () => {
        expect(getAgentById("opencode")!.configPath).toBe(
            ".claude/rules/security.md"
        );
    });
});
