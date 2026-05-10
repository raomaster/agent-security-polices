import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs, showUsage, showList } from "../cli.js";

// Silence all console output during CLI tests
beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("parseArgs — defaults", () => {
    it("returns all defaults with empty argv", () => {
        const args = parseArgs([]);
        expect(args).toEqual({
            all: false,
            agents: [],
            skills: false,
            profile: "standard",
            target: ".",
            gitignore: false,
            omo: false,
            aegis: false,
            global: false,
            help: false,
            version: false,
            list: false,
        });
    });
});

describe("parseArgs — flags", () => {
    it("--all sets all:true", () => {
        expect(parseArgs(["--all"]).all).toBe(true);
    });

    it("--skills sets skills:true", () => {
        expect(parseArgs(["--skills"]).skills).toBe(true);
    });

    it("--omo sets omo:true", () => {
        expect(parseArgs(["--omo"]).omo).toBe(true);
    });

    it("--gitignore sets gitignore:true", () => {
        expect(parseArgs(["--gitignore"]).gitignore).toBe(true);
    });

    it("--list sets list:true", () => {
        expect(parseArgs(["--list"]).list).toBe(true);
    });

    it("--help sets help:true", () => {
        expect(parseArgs(["--help"]).help).toBe(true);
    });

    it("-h sets help:true", () => {
        expect(parseArgs(["-h"]).help).toBe(true);
    });

    it("--version sets version:true", () => {
        expect(parseArgs(["--version"]).version).toBe(true);
    });

    it("-v sets version:true", () => {
        expect(parseArgs(["-v"]).version).toBe(true);
    });

    it("--omo sets omo:true", () => {
        expect(parseArgs(["--omo"]).omo).toBe(true);
    });

    it("--aegis sets aegis:true", () => {
        expect(parseArgs(["--aegis"]).aegis).toBe(true);
    });
});

describe("parseArgs — --agent", () => {
    it("single agent", () => {
        expect(parseArgs(["--agent", "opencode"]).agents).toEqual(["opencode"]);
    });

    it("comma-separated agents", () => {
        expect(parseArgs(["--agent", "copilot,claude,opencode"]).agents).toEqual([
            "copilot",
            "claude",
            "opencode",
        ]);
    });

    it("trims whitespace from agent names", () => {
        expect(parseArgs(["--agent", "copilot, claude, opencode"]).agents).toEqual([
            "copilot",
            "claude",
            "opencode",
        ]);
    });

    it("filters empty strings", () => {
        expect(parseArgs(["--agent", "copilot,,claude"]).agents).toEqual([
            "copilot",
            "claude",
        ]);
    });
});

describe("parseArgs — --profile", () => {
    it("sets profile to lite", () => {
        expect(parseArgs(["--profile", "lite"]).profile).toBe("lite");
    });

    it("sets profile to standard", () => {
        expect(parseArgs(["--profile", "standard"]).profile).toBe("standard");
    });
});

describe("parseArgs — --target", () => {
    it("sets target path", () => {
        expect(parseArgs(["--target", "/some/path"]).target).toBe("/some/path");
    });

    it("defaults to . when not set", () => {
        expect(parseArgs([]).target).toBe(".");
    });
});

describe("parseArgs — combined flags", () => {
    it("OpenCode + oh-my-openagent full command", () => {
        const args = parseArgs([
            "--agent", "opencode",
            "--skills",
            "--omo",
            "--gitignore",
        ]);
        expect(args.agents).toEqual(["opencode"]);
        expect(args.skills).toBe(true);
        expect(args.omo).toBe(true);
        expect(args.gitignore).toBe(true);
    });

    it("--all + --profile lite", () => {
        const args = parseArgs(["--all", "--profile", "lite"]);
        expect(args.all).toBe(true);
        expect(args.profile).toBe("lite");
    });

    it("all agents with target and skills", () => {
        const args = parseArgs([
            "--agent", "copilot,codex,claude,antigravity,opencode",
            "--skills",
            "--target", "/workspace/myproject",
        ]);
        expect(args.agents).toHaveLength(5);
        expect(args.skills).toBe(true);
        expect(args.target).toBe("/workspace/myproject");
    });
});

describe("parseArgs — unknown flag", () => {
    it("calls process.exit(1) on unknown flag", () => {
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation((() => { throw new Error("exit"); }) as never);
        expect(() => parseArgs(["--unknown-flag"])).toThrow("exit");
        exitSpy.mockRestore();
    });
});

describe("showUsage", () => {
    it("prints without throwing", () => {
        expect(() => showUsage()).not.toThrow();
    });

    it("logs to console.log", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        showUsage();
        expect(logSpy).toHaveBeenCalled();
    });
});

describe("showList", () => {
    it("prints without throwing", () => {
        expect(() => showList()).not.toThrow();
    });

    it("logs agent names", () => {
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((...args) => {
            output.push(args.join(" "));
        });
        showList();
        const combined = output.join("\n");
        expect(combined).toContain("opencode");
        expect(combined).toContain("copilot");
        expect(combined).toContain("claude");
    });
});
