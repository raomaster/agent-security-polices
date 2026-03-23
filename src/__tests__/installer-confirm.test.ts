/**
 * Tests for the confirmAppend interactive flow.
 * Isolated in its own file because vi.mock() is hoisted and applies to the whole module.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Mock readline so confirmAppend auto-answers "y"
vi.mock("node:readline", () => ({
    createInterface: () => ({
        question: (_prompt: string, cb: (answer: string) => void) => cb("y"),
        close: () => {},
    }),
}));

// Import install AFTER the mock is set up
const { install } = await import("../installer.js");

// Silence console
beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("install() — confirmAppend: appends to existing config (user answers Y)", () => {
    let tmpDir: string;

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("appends security rules to existing config lacking AGENT_RULES.md", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-confirm-"));
        const configPath = path.join(tmpDir, ".claude", "rules");
        fs.mkdirSync(configPath, { recursive: true });
        fs.writeFileSync(
            path.join(configPath, "security.md"),
            "---\nalwaysApply: true\n---\n\nEXISTING CONTENT WITHOUT RULES REF"
        );

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
        expect(content).toContain("EXISTING CONTENT WITHOUT RULES REF");
        expect(content).toContain("AGENT_RULES.md");
    });

    it("security rules appended contain the instructions block", async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-confirm2-"));
        const configPath = path.join(tmpDir, ".claude", "rules");
        fs.mkdirSync(configPath, { recursive: true });
        fs.writeFileSync(
            path.join(configPath, "security.md"),
            "# My existing rules\n\nSome content."
        );

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
        expect(content).toContain("agent-security-policies");
        expect(content).toContain("OWASP ASVS");
    });
});
