// src/installer.ts — Core installation logic (ported from install.sh)

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
    SUPPORTED_AGENTS,
    SKILLS_LIST,
    POLICY_FILES,
    PROFILES,
    INSTRUCTIONS_BLOCK,
    generateAegisContent,
    getAgentById,
    type AgentConfig,
    type SkillFormat,
} from "./agents.js";
import { info, ok, warn, err, step } from "./logger.js";

// ─── Package root (where AGENT_RULES.md, policies/, skills/ live) ────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

// ─── Types ──────────────────────────────────────────────────────────
export interface InstallOptions {
    agents: string[];
    profile: string;
    skills: boolean;
    target: string;
    gitignore: boolean;
    omo: boolean;
    aegis: boolean;
    global: boolean;
    /** For testing: override os.homedir() in global mode */
    _homeDir?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyIfMissing(src: string, dest: string, label: string): boolean {
    if (fs.existsSync(dest)) {
        warn(`${label} already exists — skipping`);
        return false;
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    ok(label);
    return true;
}

export function stripYamlFrontmatter(content: string): string {
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---") return content;

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            endIndex = i;
            break;
        }
    }

    if (endIndex === -1) return content;
    return lines.slice(endIndex + 1).join("\n").trimStart();
}

// ─── JSONC support (strip comments before JSON.parse) ───────────────
export function stripJsonComments(text: string): string {
    let result = "";
    let inString = false;
    let escape = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        if (escape) {
            result += ch;
            escape = false;
            i++;
            continue;
        }

        if (inString) {
            if (ch === "\\") escape = true;
            else if (ch === '"') inString = false;
            result += ch;
            i++;
            continue;
        }

        // Line comment
        if (ch === "/" && text[i + 1] === "/") {
            while (i < text.length && text[i] !== "\n") i++;
            continue;
        }

        // Block comment
        if (ch === "/" && text[i + 1] === "*") {
            i += 2;
            while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
            i += 2; // skip */
            continue;
        }

        if (ch === '"') inString = true;
        result += ch;
        i++;
    }

    return result;
}

// ─── oh-my-openagent detection ──────────────────────────────────────

/**
 * Build the list of config file paths to probe.
 * Accepts an optional homeDir override for testing.
 */
export function getOmoConfigPaths(homeDir?: string): string[] {
    const home = homeDir ?? os.homedir();
    return [
        // New name after project rename
        path.join(home, ".config", "opencode", "oh-my-openagent.jsonc"),
        path.join(home, ".config", "opencode", "oh-my-openagent.json"),
        // Legacy names (before rename)
        path.join(home, ".config", "opencode", "oh-my-opencode.jsonc"),
        path.join(home, ".config", "opencode", "oh-my-opencode.json"),
        // opencode.json / opencode.jsonc — plugin can be declared here too
        path.join(home, ".config", "opencode", "opencode.jsonc"),
        path.join(home, ".config", "opencode", "opencode.json"),
    ];
}

/**
 * Detect whether oh-my-openagent (or legacy oh-my-opencode) is installed.
 * Checks JSONC and JSON config files in standard locations.
 * @param homeDir — override home directory (for testing)
 */
export function detectOhMyOpenagent(homeDir?: string): boolean {
    const configPaths = getOmoConfigPaths(homeDir);

    for (const configPath of configPaths) {
        if (!fs.existsSync(configPath)) continue;
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            // Strip comments AND trailing commas (valid JSONC, invalid JSON)
            const cleaned = stripJsonComments(raw).replace(/,(\s*[}\]])/g, "$1");
            const config = JSON.parse(cleaned);
            const plugins: unknown[] = config.plugin ?? config.plugins ?? [];
            const found = plugins.some(
                (p) =>
                    typeof p === "string" &&
                    (p.includes("oh-my-openagent") || p.includes("oh-my-opencode"))
            );
            // Only return true on a positive match — keep searching other
            // files if this one exists but has no plugin entry (e.g. an
            // oh-my-openagent settings file that doesn't list plugins, while
            // the plugin declaration lives in opencode.json)
            if (found) return true;
        } catch {
            continue;
        }
    }
    return false;
}

/** @deprecated Use detectOhMyOpenagent() instead */
export const detectOhMyOpencode = detectOhMyOpenagent;

// ─── Agent detection ────────────────────────────────────────────────

/**
 * Detect which agents are installed on this machine.
 * Returns the subset of SUPPORTED_AGENTS whose detect() returns true.
 * @param homeDir — override home directory (for testing)
 */
export function detectAgents(homeDir?: string): AgentConfig[] {
    return SUPPORTED_AGENTS.filter((agent) => agent.detect(homeDir));
}

/**
 * Read the oh-my-openagent config and return the model configured for
 * the Sisyphus worker agent (the main OmO worker). Returns undefined if
 * the config cannot be read or no model is set.
 * @param homeDir — override home directory (for testing)
 */
export function getOmoWorkerModel(homeDir?: string): string | undefined {
    const configPaths = getOmoConfigPaths(homeDir);
    for (const configPath of configPaths) {
        if (!fs.existsSync(configPath)) continue;
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            const cleaned = stripJsonComments(raw).replace(/,(\s*[}\]])/g, "$1");
            const config = JSON.parse(cleaned);
            const model = config?.agents?.sisyphus?.model;
            if (typeof model === "string" && model.trim()) return model.trim();
        } catch {
            continue;
        }
    }
    return undefined;
}

// ─── Step 1: Core files ─────────────────────────────────────────────
function installCoreFilesTo(targetDir: string, profile: string): void {
    const profileConfig = PROFILES.find((p) => p.id === profile) ?? PROFILES[0];
    const rulesFile = profileConfig.file;

    const rulesSrc = path.join(PACKAGE_ROOT, rulesFile);
    const rulesDest = path.join(targetDir, rulesFile);
    copyIfMissing(rulesSrc, rulesDest, rulesFile);

    if (profile === "lite") {
        const fullSrc = path.join(PACKAGE_ROOT, "AGENT_RULES.md");
        const fullDest = path.join(targetDir, "AGENT_RULES.md");
        copyIfMissing(fullSrc, fullDest, "AGENT_RULES.md (full reference)");
    }

    const policiesDir = path.join(targetDir, "policies");
    ensureDir(policiesDir);
    for (const policy of POLICY_FILES) {
        const src = path.join(PACKAGE_ROOT, "policies", policy);
        const dest = path.join(policiesDir, policy);
        copyIfMissing(src, dest, `policies/${policy}`);
    }
}

function installCoreFiles(targetDir: string, profile: string): void {
    step(`Installing security policies to ${targetDir}`);
    installCoreFilesTo(targetDir, profile);
}

// ─── Step 2: Agent configs ──────────────────────────────────────────
function installAgentConfigAt(
    targetDir: string,
    configPath: string,
    agent: AgentConfig
): void {
    const fullPath = path.join(targetDir, configPath);

    if (fs.existsSync(fullPath)) {
        const existing = fs.readFileSync(fullPath, "utf-8");
        if (existing.includes("AGENT_RULES.md")) {
            warn(`${configPath} already references AGENT_RULES.md — skipping`);
        } else {
            const appendText = `\n\n<!-- agent-security-policies -->\n${INSTRUCTIONS_BLOCK}\n`;
            fs.appendFileSync(fullPath, appendText, "utf-8");
            ok(`${configPath} — appended security rules`);
        }
    } else {
        ensureDir(path.dirname(fullPath));
        const content = agent.generateConfig(INSTRUCTIONS_BLOCK);
        fs.writeFileSync(fullPath, content, "utf-8");
        ok(`${configPath} — created`);
    }
}

function installAgentConfigs(targetDir: string, agentIds: string[]): void {
    for (const agentId of agentIds) {
        const agent = getAgentById(agentId);
        if (!agent) {
            warn(`Unknown agent: ${agentId} — skipping`);
            continue;
        }

        step(`Configuring ${agent.name} (${agent.description})`);

        // Create required directories
        for (const dir of agent.directories) {
            ensureDir(path.join(targetDir, dir));
        }

        const configPath = path.join(targetDir, agent.configPath);

        if (fs.existsSync(configPath)) {
            const existing = fs.readFileSync(configPath, "utf-8");
            if (existing.includes("AGENT_RULES.md")) {
                warn(`${agent.configPath} already references AGENT_RULES.md — skipping`);
            } else {
                // Append to existing file
                const appendText = `\n\n<!-- agent-security-policies -->\n${INSTRUCTIONS_BLOCK}\n`;
                fs.appendFileSync(configPath, appendText, "utf-8");
                ok(`${agent.configPath} — appended security rules`);
            }
        } else {
            ensureDir(path.dirname(configPath));
            const content = agent.generateConfig(INSTRUCTIONS_BLOCK);
            fs.writeFileSync(configPath, content, "utf-8");
            ok(`${agent.configPath} — created`);
        }
    }
}

// ─── Step 3: Skills ─────────────────────────────────────────────────
function installSkillsTo(
    targetDir: string,
    skillFormat: SkillFormat,
    directories: string[]
): void {
    if (skillFormat.type === "none") return;

    for (const dir of directories) {
        ensureDir(path.join(targetDir, dir));
    }

    for (const skill of SKILLS_LIST) {
        const skillSrc = path.join(PACKAGE_ROOT, "skills", skill.id, "SKILL.md");
        if (!fs.existsSync(skillSrc)) continue;

        const skillContent = fs.readFileSync(skillSrc, "utf-8");

        switch (skillFormat.type) {
            case "copy": {
                const destPath = path.join(
                    targetDir,
                    skillFormat.destPattern.replace("{skill}", skill.id)
                );
                ensureDir(path.dirname(destPath));
                if (fs.existsSync(destPath)) {
                    warn(`${skillFormat.destPattern.replace("{skill}", skill.id)} already exists — skipping`);
                } else {
                    fs.copyFileSync(skillSrc, destPath);
                    ok(skillFormat.destPattern.replace("{skill}", skill.id));
                }
                break;
            }
            case "strip-frontmatter": {
                const destPath = path.join(
                    targetDir,
                    skillFormat.destPattern.replace("{skill}", skill.id)
                );
                ensureDir(path.dirname(destPath));
                if (fs.existsSync(destPath)) {
                    warn(`${skillFormat.destPattern.replace("{skill}", skill.id)} already exists — skipping`);
                } else {
                    const stripped = stripYamlFrontmatter(skillContent);
                    fs.writeFileSync(destPath, stripped, "utf-8");
                    ok(skillFormat.destPattern.replace("{skill}", skill.id));
                }
                break;
            }
            case "append": {
                const destPath = path.join(targetDir, skillFormat.destFile);
                if (fs.existsSync(destPath)) {
                    const existing = fs.readFileSync(destPath, "utf-8");
                    if (existing.includes(`skill:${skill.id}`)) {
                        warn(`${skillFormat.destFile} already contains ${skill.id} — skipping`);
                        continue;
                    }
                }
                const stripped = stripYamlFrontmatter(skillContent);
                const appendText = `\n\n<!-- skill:${skill.id} -->\n${stripped}`;
                fs.appendFileSync(destPath, appendText, "utf-8");
                ok(`${skillFormat.destFile} — appended ${skill.id} skill`);
                break;
            }
        }
    }
}

function installSkills(targetDir: string, agentIds: string[]): void {
    step("Installing security skills");

    // Copy skills/ directory
    const skillsDir = path.join(targetDir, "skills");
    ensureDir(skillsDir);

    for (const skill of SKILLS_LIST) {
        const src = path.join(PACKAGE_ROOT, "skills", skill.id, "SKILL.md");
        const destDir = path.join(skillsDir, skill.id);
        const dest = path.join(destDir, "SKILL.md");
        ensureDir(destDir);
        copyIfMissing(src, dest, `skills/${skill.id}/SKILL.md`);
    }

    // Install skills per agent format
    for (const agentId of agentIds) {
        const agent = getAgentById(agentId);
        if (!agent) continue;

        const format = agent.skillFormat;
        if (format.type === "none") continue;

        step(`Installing skills for ${agent.name}`);

        for (const skill of SKILLS_LIST) {
            const skillSrc = path.join(targetDir, "skills", skill.id, "SKILL.md");
            if (!fs.existsSync(skillSrc)) continue;

            const skillContent = fs.readFileSync(skillSrc, "utf-8");

            switch (format.type) {
                case "copy": {
                    const destPath = path.join(
                        targetDir,
                        format.destPattern.replace("{skill}", skill.id)
                    );
                    ensureDir(path.dirname(destPath));
                    if (fs.existsSync(destPath)) {
                        warn(`${format.destPattern.replace("{skill}", skill.id)} already exists — skipping`);
                    } else {
                        fs.copyFileSync(skillSrc, destPath);
                        ok(format.destPattern.replace("{skill}", skill.id));
                    }
                    break;
                }

                case "strip-frontmatter": {
                    const destPath = path.join(
                        targetDir,
                        format.destPattern.replace("{skill}", skill.id)
                    );
                    ensureDir(path.dirname(destPath));
                    if (fs.existsSync(destPath)) {
                        warn(`${format.destPattern.replace("{skill}", skill.id)} already exists — skipping`);
                    } else {
                        const stripped = stripYamlFrontmatter(skillContent);
                        fs.writeFileSync(destPath, stripped, "utf-8");
                        ok(format.destPattern.replace("{skill}", skill.id));
                    }
                    break;
                }

                case "append": {
                    const destPath = path.join(targetDir, format.destFile);
                    if (fs.existsSync(destPath)) {
                        const existing = fs.readFileSync(destPath, "utf-8");
                        if (existing.includes(`skill:${skill.id}`)) {
                            warn(`${format.destFile} already contains ${skill.id} — skipping`);
                            continue;
                        }
                    }
                    const stripped = stripYamlFrontmatter(skillContent);
                    const appendText = `\n\n<!-- skill:${skill.id} -->\n${stripped}`;
                    fs.appendFileSync(destPath, appendText, "utf-8");
                    ok(`${format.destFile} — appended ${skill.id} skill`);
                    break;
                }
            }
        }
    }
}

// ─── Global installation ─────────────────────────────────────────────
async function installGlobal(opts: InstallOptions): Promise<void> {
    const homeDir = opts._homeDir ?? os.homedir();

    for (const agentId of opts.agents) {
        const agent = getAgentById(agentId);
        if (!agent) {
            warn(`Unknown agent: ${agentId} — skipping`);
            continue;
        }

        const agentGlobalDir = agent.globalDir(homeDir);

        step(`Installing globally for ${agent.name} → ${agentGlobalDir}`);

        // Create global directories if needed
        for (const dir of agent.globalDirectories) {
            ensureDir(path.join(agentGlobalDir, dir));
        }

        // 1. Core files
        installCoreFilesTo(agentGlobalDir, opts.profile);

        // 2. Agent config
        installAgentConfigAt(agentGlobalDir, agent.globalConfigPath, agent);

        // 3. Skills
        if (opts.skills) {
            installSkillsTo(agentGlobalDir, agent.globalSkillFormat, agent.globalDirectories);
        }

        // 4. Aegis (Claude Code)
        if (opts.aegis && agentId === "claude") {
            const agentsDir = path.join(agentGlobalDir, "agents");
            ensureDir(agentsDir);
            const aegisPath = path.join(agentsDir, "aegis.md");
            if (!fs.existsSync(aegisPath)) {
                fs.writeFileSync(aegisPath, generateAegisContent("sonnet"), "utf-8");
                ok(`Aegis installed globally (Claude Code)`);
            } else {
                warn(`Aegis already exists for Claude Code — skipping`);
            }
        }

        // 5. Aegis (OpenCode)
        if (opts.omo && agentId === "opencode") {
            const agentsDir = path.join(agentGlobalDir, "agents");
            ensureDir(agentsDir);
            const aegisPath = path.join(agentsDir, "aegis.md");
            if (!fs.existsSync(aegisPath)) {
                const model = getOmoWorkerModel(homeDir);
                fs.writeFileSync(aegisPath, generateAegisContent(model), "utf-8");
                ok(`Aegis installed globally (OpenCode)`);
            } else {
                warn(`Aegis already exists for OpenCode — skipping`);
            }
        }
    }

    printGlobalSummary(opts, homeDir);
}

// ─── Step 3b: Commands ───────────────────────────────────────────────
// ─── Step 3c: Aegis agent ────────────────────────────────────────────
// OpenCode discovers agents from .opencode/agents/ (per-project)
// or ~/.config/opencode/agents/ (global). NOT from .claude/agents/.
// Claude Code discovers agents from .claude/agents/ (per-project).
function installAegisAgent(targetDir: string, agentId: "opencode" | "claude" = "opencode"): void {
    const agentsDir = agentId === "claude"
        ? path.join(targetDir, ".claude", "agents")
        : path.join(targetDir, ".opencode", "agents");
    const relPath = agentId === "claude"
        ? ".claude/agents/aegis.md"
        : ".opencode/agents/aegis.md";
    ensureDir(agentsDir);
    const aegisPath = path.join(agentsDir, "aegis.md");
    if (fs.existsSync(aegisPath)) {
        warn(`${relPath} already exists — skipping`);
        return;
    }

    let model: string | undefined;
    if (agentId === "claude") {
        // Claude Code accepts shorthand — use sonnet to avoid burning Opus on security review
        model = "sonnet";
    } else {
        // OpenCode: reuse the model the user already configured for OmO's Sisyphus worker.
        // This respects whatever provider they have (Anthropic, Copilot, OpenCode Zen, etc.)
        // and avoids hardcoding a model that may not be available to them.
        model = getOmoWorkerModel();
        if (model) {
            info(`Aegis will use model: ${model} (from oh-my-openagent Sisyphus config)`);
        }
    }

    fs.writeFileSync(aegisPath, generateAegisContent(model), "utf-8");
    ok(`${relPath} — Aegis security agent installed`);
}

// ─── Step 4: .gitignore ─────────────────────────────────────────────
const MARKER_START = "# >>> agent-security-policies >>>";
const MARKER_END = "# <<< agent-security-policies <<<";

function updateGitignore(targetDir: string, opts: InstallOptions): void {
    step("Adding installed files to .gitignore");

    const profileConfig = PROFILES.find((p) => p.id === opts.profile) ?? PROFILES[0];

    // Build entries based on what was actually installed
    const entries: string[] = [];

    // Core files (always installed)
    entries.push("AGENT_RULES.md");
    if (opts.profile === "lite") {
        entries.push("AGENT_RULES_LITE.md");
    }
    entries.push("policies/");

    // Agent config files
    for (const agentId of opts.agents) {
        const agent = getAgentById(agentId);
        if (!agent) continue;
        entries.push(agent.configPath);

        // Extra paths (e.g. .opencode/agents/ for opencode)
        if (agent.extraPaths) {
            for (const p of agent.extraPaths) {
                entries.push(p);
            }
        }
    }

    // Skills
    if (opts.skills) {
        entries.push("skills/");
        entries.push("commands/");

        // Collect unique skill directories per agent
        const skillDirs = new Set<string>();
        for (const agentId of opts.agents) {
            const agent = getAgentById(agentId);
            if (!agent) continue;

            const format = agent.skillFormat;
            switch (format.type) {
                case "copy":
                case "strip-frontmatter": {
                    // Extract directory from pattern like ".claude/commands/{skill}.md"
                    const dir = path.dirname(format.destPattern).replace(/\\/g, "/");
                    skillDirs.add(dir + "/");
                    break;
                }
                // "append" and "none" don't create separate skill directories
            }
        }
        for (const dir of skillDirs) {
            entries.push(dir);
        }
    }

    // Build the block
    const block = [MARKER_START, ...entries, MARKER_END].join("\n");

    const gitignorePath = path.join(targetDir, ".gitignore");

    if (fs.existsSync(gitignorePath)) {
        let content = fs.readFileSync(gitignorePath, "utf-8");
        const startIdx = content.indexOf(MARKER_START);
        const endIdx = content.indexOf(MARKER_END);

        if (startIdx !== -1 && endIdx !== -1) {
            // Replace existing block
            content =
                content.substring(0, startIdx) +
                block +
                content.substring(endIdx + MARKER_END.length);
            fs.writeFileSync(gitignorePath, content, "utf-8");
            ok(".gitignore — updated existing block");
        } else {
            // Append to end
            const separator = content.endsWith("\n") ? "\n" : "\n\n";
            fs.writeFileSync(gitignorePath, content + separator + block + "\n", "utf-8");
            ok(".gitignore — appended entries");
        }
    } else {
        // Create new .gitignore
        fs.writeFileSync(gitignorePath, block + "\n", "utf-8");
        ok(".gitignore — created");
    }
}

// ─── Pre-install check: detect existing files ──────────────────────
function detectExistingConfigs(targetDir: string, agentIds: string[]): string[] {
    const existing: string[] = [];
    for (const agentId of agentIds) {
        const agent = getAgentById(agentId);
        if (!agent) continue;
        const configPath = path.join(targetDir, agent.configPath);
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, "utf-8");
            if (!content.includes("AGENT_RULES.md")) {
                existing.push(agent.configPath);
            }
        }
    }
    return existing;
}

async function confirmAppend(existingFiles: string[]): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log("");
    warn("The following files already exist in the target directory:");
    console.log("");
    for (const file of existingFiles) {
        console.log(`    • ${file}`);
    }
    console.log("");
    info("These files will NOT be replaced. Security rules will be appended");
    info("to the end of each file, preserving your existing content.");
    console.log("");

    const answer = await new Promise<string>((resolve) => {
        rl.question("  Continue? (Y/n): ", (ans) => resolve(ans.trim()));
    });
    rl.close();

    if (answer.toLowerCase() === "n" || answer.toLowerCase() === "no") {
        return false;
    }
    return true;
}

// ─── Summary ────────────────────────────────────────────────────────
function printGlobalSummary(opts: InstallOptions, homeDir: string): void {
    step("Global installation complete!");
    console.log("");
    info("Security rules installed globally — applies to ALL projects on this machine");
    console.log("");
    for (const agentId of opts.agents) {
        const agent = getAgentById(agentId);
        if (!agent) continue;
        const globalDir = agent.globalDir(homeDir);
        const configFile = path.join(globalDir, agent.globalConfigPath);
        info(`${agent.name.padEnd(16)} → ${configFile}`);
    }
    console.log("");
    info(`Profile: ${opts.profile}`);
    if (opts.skills) {
        info(`Skills installed: ${SKILLS_LIST.map((s) => s.id).join(", ")}`);
    }
    console.log("");
}

function printSummary(opts: InstallOptions): void {
    step("Done!");
    console.log("");
    info(`Files installed in: ${path.resolve(opts.target)}`);
    info(`Agents configured: ${opts.agents.join(", ")}`);
    info(`Profile: ${opts.profile}`);
    if (opts.skills) {
        info(`Skills installed: ${SKILLS_LIST.map((s) => s.id).join(", ")}`);
    }
    if (opts.omo && opts.agents.includes("opencode")) {
        info("Aegis security agent installed (.opencode/agents/aegis.md)");
    }
    if (opts.aegis) {
        if (opts.agents.includes("claude")) {
            info("Aegis security agent installed (.claude/agents/aegis.md)");
        }
        if (opts.agents.includes("opencode") && !opts.omo) {
            info("Aegis security agent installed (.opencode/agents/aegis.md)");
        }
    }
    if (opts.gitignore) {
        info("Installed files added to .gitignore");
    }
    console.log("");
    console.log("  Next steps:");
    if (opts.gitignore) {
        console.log("    1. Commit the updated .gitignore to your repository");
    } else {
        console.log("    1. Commit the new files to your repository");
    }
    console.log("    2. Your AI agent will automatically detect the security rules");
    console.log("    3. Read AGENT_RULES.md for the full security ruleset");
    if (opts.skills) {
        console.log(
            "    4. Try a skill: ask your agent to run sast-scan or threat-model"
        );
    }
    if (opts.omo && opts.agents.includes("opencode")) {
        console.log("    5. Delegate security tasks to Aegis: ask your agent to invoke Aegis");
    }
    if (opts.aegis && opts.agents.includes("claude")) {
        console.log("    5. Use Aegis: run `claude --agent aegis` for full-session security coverage");
    }
    console.log("");
    console.log("  Docs: github.com/raomaster/agent-security-policies");
    console.log("");
}

// ─── Main entry ─────────────────────────────────────────────────────
export async function install(opts: InstallOptions): Promise<void> {
    if (opts.global) {
        return installGlobal(opts);
    }

    const targetDir = path.resolve(opts.target);

    // Validate target exists
    if (!fs.existsSync(targetDir)) {
        err(`Target directory does not exist: ${targetDir}`);
        process.exit(1);
    }

    // Validate profile
    if (!PROFILES.some((p) => p.id === opts.profile)) {
        err(`Invalid profile: ${opts.profile} (supported: ${PROFILES.map((p) => p.id).join(", ")})`);
        process.exit(1);
    }

    // Validate agents
    const validAgentIds = SUPPORTED_AGENTS.map((a) => a.id);
    for (const agent of opts.agents) {
        if (!validAgentIds.includes(agent)) {
            warn(`Unknown agent: ${agent} — will be skipped`);
        }
    }

    // Pre-install check: warn about existing config files
    const existingConfigs = detectExistingConfigs(targetDir, opts.agents);
    if (existingConfigs.length > 0) {
        const confirmed = await confirmAppend(existingConfigs);
        if (!confirmed) {
            info("Installation cancelled.");
            process.exit(0);
        }
    }

    // Step 1: Core files
    installCoreFiles(targetDir, opts.profile);

    // Step 2: Agent configs
    installAgentConfigs(targetDir, opts.agents);

    // Step 3: Skills
    if (opts.skills) {
        installSkills(targetDir, opts.agents);
    }

    // Step 3c: Aegis agent
    // --omo = OpenCode + oh-my-openagent (mode: all, per-project)
    if (opts.omo && opts.agents.includes("opencode")) {
        installAegisAgent(targetDir, "opencode");
    }
    // --aegis = install Aegis for each selected agent that supports it
    if (opts.aegis) {
        if (opts.agents.includes("claude")) {
            installAegisAgent(targetDir, "claude");
        }
        if (opts.agents.includes("opencode") && !opts.omo) {
            installAegisAgent(targetDir, "opencode");
        }
    }

    // Step 4: .gitignore
    if (opts.gitignore) {
        updateGitignore(targetDir, opts);
    }

    // Summary
    printSummary(opts);
}
