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
    install,
} from "../installer.js";
import { AEGIS_AGENT_CONTENT } from "../agents.js";

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
    it("returns exactly 3 paths", () => {
        expect(getOmoConfigPaths("/fake/home")).toHaveLength(3);
    });

    it("uses provided homeDir for all paths", () => {
        const paths = getOmoConfigPaths("/custom/home");
        for (const p of paths) {
            expect(p).toContain("/custom/home/.config/opencode/");
        }
    });

    it("first path is oh-my-opencode.jsonc", () => {
        expect(getOmoConfigPaths("/h")[0]).toContain("oh-my-opencode.jsonc");
    });

    it("second path is oh-my-opencode.json", () => {
        expect(getOmoConfigPaths("/h")[1]).toContain("oh-my-opencode.json");
    });

    it("third path is legacy opencode.json", () => {
        expect(getOmoConfigPaths("/h")[2]).toContain("opencode.json");
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
});

describe("detectOhMyOpencode (deprecated alias)", () => {
    it("is the same function reference as detectOhMyOpenagent", () => {
        expect(detectOhMyOpencode).toBe(detectOhMyOpenagent);
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
        });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates skills/ directory", () => {
        expect(fs.existsSync(path.join(tmpDir, "skills"))).toBe(true);
    });

    it("copies all 8 skills to skills/", () => {
        const skills = fs.readdirSync(path.join(tmpDir, "skills"));
        expect(skills).toHaveLength(8);
    });

    it("installs skills to .opencode/skills/{id}/SKILL.md", () => {
        const skillsDir = path.join(tmpDir, ".opencode", "skills");
        expect(fs.existsSync(skillsDir)).toBe(true);
        const installed = fs.readdirSync(skillsDir);
        expect(installed).toHaveLength(8);
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

    it("creates commands/ directory", () => {
        expect(fs.existsSync(path.join(tmpDir, "commands"))).toBe(true);
    });

    it("installs all 3 commands to .opencode/command/", () => {
        const cmdDir = path.join(tmpDir, ".opencode", "command");
        const cmds = fs.readdirSync(cmdDir);
        expect(cmds).toHaveLength(3);
        expect(cmds).toContain("checkpoint.md");
        expect(cmds).toContain("rollback.md");
        expect(cmds).toContain("security-review.md");
    });
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
        expect(content).toContain("model: sonnet");
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
