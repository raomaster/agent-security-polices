/**
 * Tests for interactiveMode() — readline mocked to drive all branches.
 *
 * interactiveMode asks questions in sequence:
 *   1. Scope: local (1) or global (2)
 *   2. Agent selection (local: number(s) or "all"; global: detection + deselect)
 *   3. Profile selection (1 or 2)
 *   4. Install skills? (Y/n)
 *   5. Add to .gitignore? (y/N) — local only
 *   6. Install Aegis? (Y/n) — only if opencode selected AND detectOhMyOpenagent returns true
 *   7. Install Aegis for Claude? (y/N) — only if claude selected
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SUPPORTED_AGENTS } from "../agents.js";

// ─── Mock readline before importing the module under test ───────────
vi.mock("node:readline", () => ({
    createInterface: vi.fn(),
}));

// ─── Mock detectOhMyOpenagent so we can control the omo prompt ──────
vi.mock("../installer.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../installer.js")>();
    return {
        ...actual,
        detectOhMyOpenagent: vi.fn().mockReturnValue(false),
        detectOhMyOpencode: vi.fn().mockReturnValue(false),
        detectAgents: vi.fn().mockReturnValue([]),
    };
});

// Import AFTER mocks
import * as readline from "node:readline";
import * as installer from "../installer.js";
import { interactiveMode } from "../prompts.js";

// allIndex = SUPPORTED_AGENTS.length + 1 = 6
const ALL_AGENTS_INDEX = String(SUPPORTED_AGENTS.length + 1);
// opencode is the 5th agent (index 5 in the list, answer "5")
const OPENCODE_INDEX = String(
    SUPPORTED_AGENTS.findIndex((a) => a.id === "opencode") + 1
);

/**
 * Drives `rl.question(...)` calls in sequence using the provided answers array.
 */
function setupReadline(answers: string[]): void {
    const queue = [...answers];
    const mockInterface = {
        question: vi.fn().mockImplementation(
            (_prompt: string, cb: (answer: string) => void) => {
                cb(queue.shift() ?? "");
            }
        ),
        close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(
        mockInterface as unknown as readline.Interface
    );
}

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

// ─── Agent selection ─────────────────────────────────────────────────

describe("interactiveMode — agent selection", () => {
    it("selects all agents when user enters the all-index number", async () => {
        // Q1: all-index, Q2: profile 1, Q3: install skills Y, Q4: gitignore N
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "y", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
        expect(result.agents).toContain("opencode");
    });

    it("selects all agents when user types 'all'", async () => {
        setupReadline(["1", "all", "1", "y", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
    });

    it("selects a single specific agent by number", async () => {
        setupReadline(["1", OPENCODE_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toEqual(["opencode"]);
    });

    it("selects multiple agents by comma-separated numbers", async () => {
        setupReadline(["1", "1,3", "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(2);
        expect(result.agents).toContain("copilot");
        expect(result.agents).toContain("claude");
    });

    it("defaults to all agents when selection is invalid (out of range)", async () => {
        setupReadline(["1", "99", "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
    });

    it("defaults to all agents when answer is empty", async () => {
        setupReadline(["1", "", "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
    });

    it("defaults to all agents when answer is non-numeric text (not 'all')", async () => {
        setupReadline(["1", "invalid-text", "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
    });
});

// ─── Profile selection ───────────────────────────────────────────────

describe("interactiveMode — profile selection", () => {
    it("returns standard profile when user picks 1", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.profile).toBe("standard");
    });

    it("returns lite profile when user picks 2", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "2", "n", "n"]);
        const result = await interactiveMode();
        expect(result.profile).toBe("lite");
    });

    it("defaults to standard profile on invalid selection", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "99", "n", "n"]);
        const result = await interactiveMode();
        expect(result.profile).toBe("standard");
    });

    it("defaults to standard profile on empty input", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "", "n", "n"]);
        const result = await interactiveMode();
        expect(result.profile).toBe("standard");
    });
});

// ─── Skills selection ────────────────────────────────────────────────

describe("interactiveMode — skills selection", () => {
    it("skills:true when user answers Y (default/implicit yes)", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "y", "n"]);
        const result = await interactiveMode();
        expect(result.skills).toBe(true);
    });

    it("skills:true when user presses enter (empty = not 'n')", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "", "n"]);
        const result = await interactiveMode();
        expect(result.skills).toBe(true);
    });

    it("skills:false when user answers n", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.skills).toBe(false);
    });

    it("skills:false when user answers no", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "no", "n"]);
        const result = await interactiveMode();
        expect(result.skills).toBe(false);
    });

    it("skills:false is case-insensitive (N, NO)", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "N", "n"]);
        const result = await interactiveMode();
        expect(result.skills).toBe(false);
    });
});

// ─── Gitignore selection ─────────────────────────────────────────────

describe("interactiveMode — gitignore selection", () => {
    it("gitignore:false when user presses enter (default N)", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", ""]);
        const result = await interactiveMode();
        expect(result.gitignore).toBe(false);
    });

    it("gitignore:false when user answers n", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.gitignore).toBe(false);
    });

    it("gitignore:true when user answers y", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "y"]);
        const result = await interactiveMode();
        expect(result.gitignore).toBe(true);
    });

    it("gitignore:true when user answers yes", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "yes"]);
        const result = await interactiveMode();
        expect(result.gitignore).toBe(true);
    });
});

// ─── Aegis / OmO prompt ──────────────────────────────────────────────

describe("interactiveMode — Aegis (omo) prompt", () => {
    it("does NOT ask about Aegis when opencode is not selected", async () => {
        // Select only copilot (index 1)
        setupReadline(["1", "1", "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(false);
    });

    it("does NOT ask about Aegis when oh-my-openagent is not detected", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(false);
        setupReadline(["1", OPENCODE_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(false);
    });

    it("asks about Aegis and returns omo:true when oh-my-openagent detected and user says Y", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(true);
        // Q1: opencode, Q2: profile, Q3: skills, Q4: gitignore, Q5: omo (Y)
        setupReadline(["1", OPENCODE_INDEX, "1", "n", "n", "y"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(true);
    });

    it("returns omo:false when oh-my-openagent detected but user says n", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(true);
        setupReadline(["1", OPENCODE_INDEX, "1", "n", "n", "n"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(false);
    });

    it("returns omo:false when oh-my-openagent detected but user says no", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(true);
        setupReadline(["1", OPENCODE_INDEX, "1", "n", "n", "no"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(false);
    });

    it("omo:true when opencode is among multiple agents and OmO detected", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(true);
        setupReadline(["1", "1," + OPENCODE_INDEX, "1", "n", "n", "y"]);
        const result = await interactiveMode();
        expect(result.omo).toBe(true);
        expect(result.agents).toContain("opencode");
        expect(result.agents).toContain("copilot");
    });
});

// ─── Full round-trip ─────────────────────────────────────────────────

describe("interactiveMode — full result shapes", () => {
    it("returns complete InteractiveResult with all fields", async () => {
        setupReadline(["1", OPENCODE_INDEX, "1", "y", "y"]);
        const result = await interactiveMode();
        expect(result).toHaveProperty("agents");
        expect(result).toHaveProperty("profile");
        expect(result).toHaveProperty("skills");
        expect(result).toHaveProperty("gitignore");
        expect(result).toHaveProperty("omo");
        expect(result).toHaveProperty("aegis");
        expect(result).toHaveProperty("global");
    });

    it("handles full OpenCode+OmO scenario", async () => {
        vi.mocked(installer.detectOhMyOpenagent).mockReturnValue(true);
        setupReadline(["1", OPENCODE_INDEX, "1", "y", "y", "y"]);
        const result = await interactiveMode();
        expect(result).toEqual({
            agents: ["opencode"],
            profile: "standard",
            skills: true,
            gitignore: true,
            omo: true,
            aegis: false,
            global: false,
        });
    });

    it("handles all-agents scenario with lite profile", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "2", "y", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toHaveLength(SUPPORTED_AGENTS.length);
        expect(result.profile).toBe("lite");
        expect(result.skills).toBe(true);
        expect(result.gitignore).toBe(false);
        expect(result.omo).toBe(false);
    });
});

describe("interactiveMode — global scope", () => {
    it("global:false when user picks 1 (local)", async () => {
        setupReadline(["1", ALL_AGENTS_INDEX, "1", "n", "n"]);
        const result = await interactiveMode();
        expect(result.global).toBe(false);
    });

    it("global:true when user picks 2 with detected agent, keeps all", async () => {
        const claudeAgent = SUPPORTED_AGENTS.find((a) => a.id === "claude")!;
        vi.mocked(installer.detectAgents).mockReturnValue([claudeAgent]);
        // scope=2, deselect="" (keep all), profile=1, skills=n
        setupReadline(["2", "", "1", "n"]);
        const result = await interactiveMode();
        expect(result.global).toBe(true);
        expect(result.agents).toContain("claude");
        expect(result.gitignore).toBe(false);
    });

    it("global mode removes deselected agents", async () => {
        const claudeAgent = SUPPORTED_AGENTS.find((a) => a.id === "claude")!;
        const codexAgent = SUPPORTED_AGENTS.find((a) => a.id === "codex")!;
        vi.mocked(installer.detectAgents).mockReturnValue([claudeAgent, codexAgent]);
        // scope=2, deselect="1" (remove claude), profile=1, skills=n
        setupReadline(["2", "1", "1", "n"]);
        const result = await interactiveMode();
        expect(result.agents).toContain("codex");
        expect(result.agents).not.toContain("claude");
    });

    it("global mode skips gitignore question (fewer readline answers needed)", async () => {
        const claudeAgent = SUPPORTED_AGENTS.find((a) => a.id === "claude")!;
        vi.mocked(installer.detectAgents).mockReturnValue([claudeAgent]);
        // Only 4 answers: scope="2", deselect="", profile="1", skills="n"
        // No gitignore answer between skills and the end!
        setupReadline(["2", "", "1", "n"]);
        const result = await interactiveMode();
        expect(result.global).toBe(true);
        expect(result.gitignore).toBe(false);
        expect(result.skills).toBe(false);
    });
});
