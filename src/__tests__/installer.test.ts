import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
    stripJsonComments,
    stripYamlFrontmatter,
    detectOhMyOpenagent,
    detectOhMyOpencode,
    getOmoConfigPaths,
    getOmoWorkerModel,
    install,
    detectAgents,
} from "../installer.js";
import { AEGIS_AGENT_CONTENT, generateAegisContent } from "../agents.js";

// Silence all installer output
beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

// ─── stripJsonComments ──────────────────────────────────────────────

describe("stripJsonComments", () => {
    it("returns plain JSON unchanged", () => {
        const input = '{"key": "value", "num": 42}';
        expect(stripJsonComments(input)).toBe(input);
    });

    it("strips // line comments", () => {
        const input = `{\n  // comment\n  "key": "value"\n}`;
        const parsed = JSON.parse(stripJsonComments(input));
        expect(parsed.key).toBe("value");
    });

    it("strips /* block comments */", () => {
        const input = `{\n  /* block\n     comment */\n  "key": "value"\n}`;
        const parsed = JSON.parse(stripJsonComments(input));
        expect(parsed.key).toBe("value");
    });

    it("preserves // inside string values", () => {
        const input = '{"url": "https://example.com"}';
        expect(stripJsonComments(input)).toBe(input);
    });

    it("preserves /* inside string values", () => {
        const input = '{"pattern": "/* glob */"}';
        expect(stripJsonComments(input)).toBe(input);
    });

    it("handles escaped quotes in strings", () => {
        const input = '{"k": "val \\"with\\" quotes"}';
        expect(stripJsonComments(input)).toBe(input);
    });

    it("handles empty input", () => {
        expect(stripJsonComments("")).toBe("");
    });

    it("handles full oh-my-openagent JSONC config", () => {
        const input = `{
  // oh-my-openagent configuration
  "plugin": ["oh-my-openagent"],
  "agents": {
    /* sisyphus config */
    "sisyphus": { "model": "claude-opus-4-6" /* flagship */ }
  }
}`;
        const parsed = JSON.parse(stripJsonComments(input));
        expect(parsed.plugin).toEqual(["oh-my-openagent"]);
        expect(parsed.agents.sisyphus.model).toBe("claude-opus-4-6");
    });
});

// ─── stripYamlFrontmatter ───────────────────────────────────────────

describe("stripYamlFrontmatter", () => {
    it("strips frontmatter from content", () => {
        const content = `---\ndescription: Test\n---\n\n# Body\n\nContent here.`;
        const result = stripYamlFrontmatter(content);
        expect(result).toBe("# Body\n\nContent here.");
        expect(result).not.toContain("---");
        expect(result).not.toContain("description:");
    });

    it("returns content unchanged when no frontmatter", () => {
        const content = "# No frontmatter\n\nJust content.";
        expect(stripYamlFrontmatter(content)).toBe(content);
    });

    it("returns content unchanged when only opening --- (no closing)", () => {
        const content = "---\ndescription: orphan";
        expect(stripYamlFrontmatter(content)).toBe(content);
    });

    it("trims leading whitespace from body", () => {
        const content = `---\nfoo: bar\n---\n\n\n# Title`;
        const result = stripYamlFrontmatter(content);
        expect(result).toBe("# Title");
    });

    it("handles SKILL.md frontmatter format", () => {
        const content = `---
description: Run Semgrep SAST scan
tools:
  - Bash
---

# SAST Scan

Run semgrep.`;
        const result = stripYamlFrontmatter(content);
        expect(result).toBe("# SAST Scan\n\nRun semgrep.");
    });
});

// ─── getOmoConfigPaths ──────────────────────────────────────────────

describe("getOmoConfigPaths", () => {
    it("returns exactly 6 paths", () => {
        expect(getOmoConfigPaths("/fake/home")).toHaveLength(6);
    });

    it("uses provided homeDir for all paths", () => {
        const paths = getOmoConfigPaths("/custom/home");
        for (const p of paths) {
            expect(p).toContain("/custom/home/.config/opencode/");
        }
    });

    it("first path is oh-my-openagent.jsonc (new name)", () => {
        expect(getOmoConfigPaths("/h")[0]).toContain("oh-my-openagent.jsonc");
    });

    it("second path is oh-my-openagent.json (new name)", () => {
        expect(getOmoConfigPaths("/h")[1]).toContain("oh-my-openagent.json");
    });

    it("includes legacy oh-my-opencode.jsonc", () => {
        const paths = getOmoConfigPaths("/h");
        expect(paths.some((p) => p.includes("oh-my-opencode.jsonc"))).toBe(true);
    });

    it("includes legacy oh-my-opencode.json", () => {
        const paths = getOmoConfigPaths("/h");
        expect(paths.some((p) => p.includes("oh-my-opencode.json"))).toBe(true);
    });

    it("includes opencode.jsonc", () => {
        const paths = getOmoConfigPaths("/h");
        expect(paths.some((p) => p.includes("opencode.jsonc"))).toBe(true);
    });

    it("includes opencode.json", () => {
        const paths = getOmoConfigPaths("/h");
        expect(paths.some((p) => p.includes("opencode.json"))).toBe(true);
    });

    it("uses os.homedir() when no homeDir provided", () => {
        const paths = getOmoConfigPaths();
        for (const p of paths) {
            expect(p).toContain(os.homedir());
        }
    });
});

// ─── detectOhMyOpenagent ────────────────────────────────────────────

describe("detectOhMyOpenagent", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-detect-"));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns false when no config file exists", () => {
        expect(detectOhMyOpenagent(tmpDir)).toBe(false);
    });

    it("returns true: oh-my-openagent in plugin array via JSONC", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.jsonc"),
            `{\n  // config\n  "plugin": ["oh-my-openagent"]\n}`
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns true: oh-my-openagent in plugin array via JSON", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.json"),
            '{"plugin": ["oh-my-openagent"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns true: legacy oh-my-opencode in plugins array", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": ["oh-my-opencode"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns true with 'plugins' key (legacy) and oh-my-openagent value", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": ["oh-my-openagent"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns false: config exists but plugin not listed", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.jsonc"),
            '{"plugin": ["some-other-plugin"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(false);
    });

    it("returns false: config exists with empty plugins", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": []}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(false);
    });

    it("returns false: malformed JSON/JSONC", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.jsonc"),
            "NOT_VALID_JSON_AT_ALL"
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(false);
    });

    it("returns false: no plugin/plugins key", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"agents": {}}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(false);
    });

    it("first matching path wins: JSONC has plugin, legacy does not", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.jsonc"),
            '{"plugin": ["oh-my-openagent"]}'
        );
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": ["other"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("handles block comments in JSONC config", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-opencode.jsonc"),
            `{\n  /* Plugin config */\n  "plugin": ["oh-my-openagent" /* main plugin */]\n}`
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    // Bug fix: new filename oh-my-openagent.jsonc (after project rename)
    it("returns true: oh-my-openagent in oh-my-openagent.jsonc (new filename)", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.jsonc"),
            `{\n  // new config name\n  "plugin": ["oh-my-openagent"]\n}`
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns true: oh-my-openagent in oh-my-openagent.json (new filename)", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.json"),
            '{"plugin": ["oh-my-openagent"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    // Bug fix: trailing commas in JSONC (valid JSONC, invalid JSON)
    it("returns true: JSONC with trailing commas", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.jsonc"),
            `{\n  "plugin": ["oh-my-openagent",],\n}`
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    it("returns true: opencode.jsonc with trailing commas and plugin", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.jsonc"),
            `{\n  "plugins": ["oh-my-openagent",],\n}`
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });

    // Bug fix: fall-through when file exists but has no plugin entry
    it("falls through to opencode.json when oh-my-openagent.jsonc has no plugin key", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        // oh-my-openagent.jsonc exists but has agent settings, not plugin declaration
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.jsonc"),
            '{"agents": {"security": true}}'
        );
        // plugin is declared in opencode.json
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": ["oh-my-openagent"]}'
        );
        expect(detectOhMyOpenagent(tmpDir)).toBe(true);
    });
});

describe("detectOhMyOpencode (deprecated alias)", () => {
    it("is the same function reference as detectOhMyOpenagent", () => {
        expect(detectOhMyOpencode).toBe(detectOhMyOpenagent);
    });
});

// ─── getOmoWorkerModel ──────────────────────────────────────────────

describe("getOmoWorkerModel", () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-wm-")); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it("returns undefined when no config file exists", () => {
        expect(getOmoWorkerModel(tmpDir)).toBeUndefined();
    });

    it("returns model from agents.sisyphus.model in oh-my-openagent.jsonc", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.jsonc"),
            `{\n  "plugin": ["oh-my-openagent"],\n  "agents": { "sisyphus": { "model": "anthropic/claude-sonnet-4-6" } }\n}`
        );
        expect(getOmoWorkerModel(tmpDir)).toBe("anthropic/claude-sonnet-4-6");
    });

    it("returns model from opencode.json when oh-my-openagent.jsonc has no agents key", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "opencode.json"),
            '{"plugins": ["oh-my-openagent"], "agents": {"sisyphus": {"model": "github-copilot/claude-opus-4-6"}}}'
        );
        expect(getOmoWorkerModel(tmpDir)).toBe("github-copilot/claude-opus-4-6");
    });

    it("returns undefined when sisyphus has no model key", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "oh-my-openagent.jsonc"),
            '{"plugin": ["oh-my-openagent"], "agents": {"sisyphus": {}}}'
        );
        expect(getOmoWorkerModel(tmpDir)).toBeUndefined();
    });

    it("returns undefined when config is malformed", () => {
        const dir = path.join(tmpDir, ".config", "opencode");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "oh-my-openagent.jsonc"), "NOT_JSON");
        expect(getOmoWorkerModel(tmpDir)).toBeUndefined();
    });
});

// ─── generateAegisContent ───────────────────────────────────────────

describe("generateAegisContent", () => {
    it("omits model line when no model provided", () => {
        const content = generateAegisContent();
        expect(content).not.toContain("model:");
    });

    it("injects model line when model provided", () => {
        const content = generateAegisContent("anthropic/claude-sonnet-4-6");
        expect(content).toContain("model: anthropic/claude-sonnet-4-6");
    });

    it("model line appears before mode: all in frontmatter", () => {
        const content = generateAegisContent("sonnet");
        const modelIdx = content.indexOf("model: sonnet");
        const modeIdx = content.indexOf("mode: all");
        expect(modelIdx).toBeLessThan(modeIdx);
    });

    it("AEGIS_AGENT_CONTENT default has no model", () => {
        expect(AEGIS_AGENT_CONTENT).not.toContain("model:");
    });
});

// ─── install() — end-to-end integration tests ───────────────────────

describe("install() — opencode vanilla (no skills, no omo)", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-e2e-"));
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates AGENT_RULES.md", () => {
        expect(fs.existsSync(path.join(tmpDir, "AGENT_RULES.md"))).toBe(true);
    });

    it("creates policies directory", () => {
        expect(fs.existsSync(path.join(tmpDir, "policies"))).toBe(true);
    });

    it("copies all 6 policy files", () => {
        const policies = fs.readdirSync(path.join(tmpDir, "policies"));
        expect(policies).toHaveLength(6);
    });

    it("creates .claude/rules/security.md", () => {
        expect(
            fs.existsSync(path.join(tmpDir, ".claude", "rules", "security.md"))
        ).toBe(true);
    });

    it("security.md has YAML frontmatter with alwaysApply", () => {
        const content = fs.readFileSync(
            path.join(tmpDir, ".claude", "rules", "security.md"),
            "utf-8"
        );
        expect(content).toMatch(/^---\n/);
        expect(content).toContain("alwaysApply: true");
    });

    it("creates .opencode/skills dir but leaves it empty (skills:false)", () => {
        // installAgentConfigs creates agent.directories regardless of --skills
        const skillsDir = path.join(tmpDir, ".opencode", "skills");
        expect(fs.existsSync(skillsDir)).toBe(true);
        expect(fs.readdirSync(skillsDir)).toHaveLength(0);
    });

    it("does NOT create .opencode/agents/aegis.md (omo:false)", () => {
        expect(fs.existsSync(path.join(tmpDir, ".opencode", "agents", "aegis.md"))).toBe(false);
    });
});

describe("install() — opencode with skills", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-skills-"));
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: true,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates skills/ directory", () => {
        expect(fs.existsSync(path.join(tmpDir, "skills"))).toBe(true);
    });

    it("copies all 10 skills to skills/", () => {
        const skills = fs.readdirSync(path.join(tmpDir, "skills"));
        expect(skills).toHaveLength(10);
    });

    it("installs skills to .opencode/skills/{id}/SKILL.md", () => {
        const skillsDir = path.join(tmpDir, ".opencode", "skills");
        expect(fs.existsSync(skillsDir)).toBe(true);
        const installed = fs.readdirSync(skillsDir);
        expect(installed).toHaveLength(10);
    });

    it("each opencode skill is a complete copy with frontmatter", () => {
        const skillPath = path.join(
            tmpDir,
            ".opencode",
            "skills",
            "sast-scan",
            "SKILL.md"
        );
        const content = fs.readFileSync(skillPath, "utf-8");
        expect(content).toMatch(/^---\n/);
        expect(content).toContain("description:");
    });

    // command tests removed — commands migrated to skills infrastructure
});

describe("install() — opencode with omo (Aegis discipline agent)", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-omo-"));
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: true,
            aegis: false,
            global: false,
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates .opencode/agents/aegis.md", () => {
        expect(
            fs.existsSync(path.join(tmpDir, ".opencode", "agents", "aegis.md"))
        ).toBe(true);
    });

    it("aegis.md content matches AEGIS_AGENT_CONTENT exactly", () => {
        const written = fs.readFileSync(
            path.join(tmpDir, ".opencode", "agents", "aegis.md"),
            "utf-8"
        );
        expect(written).toBe(AEGIS_AGENT_CONTENT);
    });

    it("aegis.md is a valid discipline agent with name: Aegis", () => {
        const content = fs.readFileSync(
            path.join(tmpDir, ".opencode", "agents", "aegis.md"),
            "utf-8"
        );
        expect(content).toContain("name: Aegis");
        expect(content).toContain("mode: all");
    });

    it("does NOT install Aegis when agent is not opencode", async () => {
        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "asp-noomo-"));
        try {
            await install({
                agents: ["claude"],
                profile: "standard",
                skills: false,
                target: tmp2,
                gitignore: false,
                omo: true,
            });
            expect(
                fs.existsSync(path.join(tmp2, ".opencode", "agents", "aegis.md"))
            ).toBe(false);
        } finally {
            fs.rmSync(tmp2, { recursive: true, force: true });
        }
    });
});

describe("install() — claude agent with --aegis (Claude Code subagent)", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-aegis-claude-"));
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: true,
            global: false,
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates .claude/agents/aegis.md", () => {
        expect(
            fs.existsSync(path.join(tmpDir, ".claude", "agents", "aegis.md"))
        ).toBe(true);
    });

    it("aegis.md content includes model: sonnet for Claude Code", () => {
        const written = fs.readFileSync(
            path.join(tmpDir, ".claude", "agents", "aegis.md"),
            "utf-8"
        );
        expect(written).toBe(generateAegisContent("sonnet"));
        expect(written).toContain("model: sonnet");
    });

    it("does NOT create .opencode/agents/aegis.md for claude agent", () => {
        expect(
            fs.existsSync(path.join(tmpDir, ".opencode", "agents", "aegis.md"))
        ).toBe(false);
    });

    it("--aegis without claude does NOT create .claude/agents/aegis.md", async () => {
        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "asp-aegis-none-"));
        try {
            await install({
                agents: ["opencode"],
                profile: "standard",
                skills: false,
                target: tmp2,
                gitignore: false,
                omo: false,
                aegis: true,
            });
            // opencode + aegis (no omo) → .opencode/agents/aegis.md
            expect(
                fs.existsSync(path.join(tmp2, ".opencode", "agents", "aegis.md"))
            ).toBe(true);
            // .claude/agents/aegis.md NOT created
            expect(
                fs.existsSync(path.join(tmp2, ".claude", "agents", "aegis.md"))
            ).toBe(false);
        } finally {
            fs.rmSync(tmp2, { recursive: true, force: true });
        }
    });
});

describe("install() — gitignore management", () => {
    let tmpDir: string;

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates .gitignore when it does not exist", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-gi-"));
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: true,
            target: tmpDir,
            gitignore: true,
            omo: true,
            aegis: false,
            global: false,
        });
        const giPath = path.join(tmpDir, ".gitignore");
        expect(fs.existsSync(giPath)).toBe(true);
        const content = fs.readFileSync(giPath, "utf-8");
        expect(content).toContain("# >>> agent-security-policies >>>");
        expect(content).toContain("# <<< agent-security-policies <<<");
        expect(content).toContain("AGENT_RULES.md");
        expect(content).toContain(".claude/rules/security.md");
        expect(content).toContain(".opencode/skills/");
        expect(content).toContain(".opencode/agents/");
    });

    it("appends to existing .gitignore without markers", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-gi-append-"));
        const giPath = path.join(tmpDir, ".gitignore");
        fs.writeFileSync(giPath, "node_modules/\n.env\n");
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: true,
            omo: false,
            aegis: false,
            global: false,
        });
        const content = fs.readFileSync(giPath, "utf-8");
        expect(content).toContain("node_modules/");
        expect(content).toContain(".env");
        expect(content).toContain("# >>> agent-security-policies >>>");
    });

    it("replaces existing marker block in .gitignore", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-gi-replace-"));
        const giPath = path.join(tmpDir, ".gitignore");
        const existing = [
            "node_modules/",
            "# >>> agent-security-policies >>>",
            "OLD_CONTENT.md",
            "# <<< agent-security-policies <<<",
            ".env",
        ].join("\n");
        fs.writeFileSync(giPath, existing);
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: true,
            omo: false,
            aegis: false,
            global: false,
        });
        const content = fs.readFileSync(giPath, "utf-8");
        expect(content).not.toContain("OLD_CONTENT.md");
        expect(content).toContain("AGENT_RULES.md");
        expect(content).toContain("node_modules/");
        expect(content).toContain(".env");
    });

    it("does not create .gitignore when gitignore:false", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-gi-skip-"));
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(false);
    });
});

describe("install() — agent-specific formats", () => {
    let tmpDir: string;

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("claude: skills stripped of frontmatter and placed in .claude/commands/", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-claude-"));
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: true,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        const skillPath = path.join(tmpDir, ".claude", "commands", "sast-scan.md");
        expect(fs.existsSync(skillPath)).toBe(true);
        const content = fs.readFileSync(skillPath, "utf-8");
        // strip-frontmatter: no YAML header
        expect(content).not.toMatch(/^---\n/);
    });

    it("claude: creates CLAUDE.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-claude2-"));
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
    });

    it("copilot: creates .github/copilot-instructions.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-copilot-"));
        await install({
            agents: ["copilot"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        expect(
            fs.existsSync(path.join(tmpDir, ".github", "copilot-instructions.md"))
        ).toBe(true);
    });

    it("codex: creates AGENTS.md with appended skills", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-codex-"));
        await install({
            agents: ["codex"],
            profile: "standard",
            skills: true,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        const agentsMd = path.join(tmpDir, "AGENTS.md");
        expect(fs.existsSync(agentsMd)).toBe(true);
        const content = fs.readFileSync(agentsMd, "utf-8");
        expect(content).toContain("skill:sast-scan");
    });

    it("antigravity: creates .agent/rules/security.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-anti-"));
        await install({
            agents: ["antigravity"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        expect(
            fs.existsSync(path.join(tmpDir, ".agent", "rules", "security.md"))
        ).toBe(true);
    });
});

describe("install() — profile: lite", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-lite-"));
        await install({
            agents: ["opencode"],
            profile: "lite",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("copies AGENT_RULES_LITE.md", () => {
        expect(fs.existsSync(path.join(tmpDir, "AGENT_RULES_LITE.md"))).toBe(true);
    });

    it("also copies full AGENT_RULES.md as reference", () => {
        expect(fs.existsSync(path.join(tmpDir, "AGENT_RULES.md"))).toBe(true);
    });

    describe("AGENT_RULES_LITE.md content", () => {
        let content: string;
        beforeEach(() => {
            content = fs.readFileSync(path.join(tmpDir, "AGENT_RULES_LITE.md"), "utf-8");
        });

        it("stays under 1400 token budget (~5600 chars)", () => {
            expect(content.length).toBeLessThan(5600);
        });

        it("contains all 12 security rules", () => {
            expect(content).toMatch(/CWE-20/);   // Input
            expect(content).toMatch(/CWE-798/);  // Secrets
            expect(content).toMatch(/CWE-755/);  // Errors
            expect(content).toMatch(/shell=False/); // Subprocess
            expect(content).toMatch(/CWE-362/);  // Concurrency
        });

        it("contains STRIDE section for threat-model skill", () => {
            expect(content).toMatch(/STRIDE/);
            expect(content).toMatch(/Spoofing/);
            expect(content).toMatch(/Tampering/);
            expect(content).toMatch(/Repudiation/);
            expect(content).toMatch(/Elevation/);
        });

        it("contains ASVS V1-V17 review checklist", () => {
            expect(content).toMatch(/ASVS/);
            for (let v = 1; v <= 17; v++) {
                expect(content).toMatch(new RegExp(`V${v}\\b`));
            }
        });

        it("contains severity and verdict criteria", () => {
            expect(content).toMatch(/CRITICAL/);
            expect(content).toMatch(/FAIL/);
            expect(content).toMatch(/CONDITIONAL/);
            expect(content).toMatch(/PASS/);
        });

        it("contains all 25 CWE entries", () => {
            const cwes = [79, 89, 352, 22, 125, 78, 416, 862, 287, 20,
                          306, 502, 269, 863, 476, 798, 190, 434, 200, 77,
                          918, 362, 611, 119, 94];
            for (const cwe of cwes) {
                expect(content).toMatch(new RegExp(`\\b${cwe}\\b`));
            }
        });

        it("references AGENT_RULES.md and policies for more detail", () => {
            expect(content).toMatch(/AGENT_RULES\.md/);
            expect(content).toMatch(/policies/);
        });
    });
});

describe("install() — non-destructive (skip existing files)", () => {
    let tmpDir: string;

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not overwrite existing AGENT_RULES.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-nooverwrite-"));
        const rulesPath = path.join(tmpDir, "AGENT_RULES.md");
        fs.writeFileSync(rulesPath, "ORIGINAL CONTENT");
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        expect(fs.readFileSync(rulesPath, "utf-8")).toBe("ORIGINAL CONTENT");
    });

    it("skips existing config that already references AGENT_RULES.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-skip-"));
        const configPath = path.join(tmpDir, ".claude", "rules");
        fs.mkdirSync(configPath, { recursive: true });
        const original = "---\nalwaysApply: true\n---\n\nFollow AGENT_RULES.md rules.";
        fs.writeFileSync(path.join(configPath, "security.md"), original);
        await install({
            agents: ["opencode"],
            profile: "standard",
            skills: false,
            target: tmpDir,
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
        });
        const content = fs.readFileSync(
            path.join(configPath, "security.md"),
            "utf-8"
        );
        // Not doubled
        expect(content).toBe(original);
    });
});

describe("install() — error paths", () => {
    it("exits when target directory does not exist", async () => {
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation((() => { throw new Error("exit:1"); }) as never);
        await expect(
            install({
                agents: ["opencode"],
                profile: "standard",
                skills: false,
                target: "/this/does/not/exist/ever",
                gitignore: false,
                omo: false,
            })
        ).rejects.toThrow("exit:1");
        exitSpy.mockRestore();
    });

    it("exits when profile is invalid", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-err-"));
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation((() => { throw new Error("exit:1"); }) as never);
        try {
            await expect(
                install({
                    agents: ["opencode"],
                    profile: "nonexistent-profile",
                    skills: false,
                    target: tmpDir,
                    gitignore: false,
                    omo: false,
                })
            ).rejects.toThrow("exit:1");
        } finally {
            exitSpy.mockRestore();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

describe("detectAgents", () => {
    it("returns detected agents only", () => {
        // Use a temp home dir. Only create .claude and .codex
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "asp-detect-test-"));
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        fs.mkdirSync(path.join(tmpHome, ".codex"), { recursive: true });

        const detected = detectAgents(tmpHome);
        const ids = detected.map((a) => a.id);
        expect(ids).toContain("claude");
        expect(ids).toContain("codex");
        expect(ids).not.toContain("opencode");
        expect(ids).not.toContain("antigravity");

        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it("returns empty array when no agents detected", () => {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "asp-detect-test-"));
        // No directories created
        const detected = detectAgents(tmpHome);
        expect(detected).toEqual([]);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
});

describe("installGlobal", () => {
    let tmpHome: string;

    beforeEach(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "asp-global-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it("installs AGENT_RULES.md into claude's globalDir", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(
            fs.existsSync(path.join(tmpHome, ".claude", "AGENT_RULES.md"))
        ).toBe(true);
    });

    it("installs CLAUDE.md into claude's globalDir", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(
            fs.existsSync(path.join(tmpHome, ".claude", "CLAUDE.md"))
        ).toBe(true);
    });

    it("installs policies/ into claude's globalDir", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(
            fs.existsSync(path.join(tmpHome, ".claude", "policies", "base_policy.yaml"))
        ).toBe(true);
    });

    it("does not write .gitignore in global mode", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: false,
            target: ".",
            gitignore: true,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(
            fs.existsSync(path.join(tmpHome, ".claude", ".gitignore"))
        ).toBe(false);
    });

    it("installs to multiple agents simultaneously", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
        fs.mkdirSync(path.join(tmpHome, ".codex"), { recursive: true });
        await install({
            agents: ["claude", "codex"],
            profile: "lite",
            skills: false,
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(fs.existsSync(path.join(tmpHome, ".claude", "AGENT_RULES_LITE.md"))).toBe(true);
        expect(fs.existsSync(path.join(tmpHome, ".codex", "AGENT_RULES_LITE.md"))).toBe(true);
        expect(fs.existsSync(path.join(tmpHome, ".claude", "CLAUDE.md"))).toBe(true);
        expect(fs.existsSync(path.join(tmpHome, ".codex", "AGENTS.md"))).toBe(true);
    });

    it("installs skills to global agent directory", async () => {
        fs.mkdirSync(path.join(tmpHome, ".claude", "commands"), { recursive: true });
        await install({
            agents: ["claude"],
            profile: "standard",
            skills: true,
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: true,
            _homeDir: tmpHome,
        });
        expect(
            fs.existsSync(path.join(tmpHome, ".claude", "commands", "sast-scan.md"))
        ).toBe(true);
    });
});
