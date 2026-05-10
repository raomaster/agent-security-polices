// src/prompts.ts — Interactive mode (readline-based, zero dependencies)

import * as readline from "node:readline";
import * as os from "node:os";
import { SUPPORTED_AGENTS, PROFILES, SKILLS_LIST } from "./agents.js";
import { detectOhMyOpenagent, detectAgents } from "./installer.js";
import { bold, cyan, dim } from "./logger.js";

interface InteractiveResult {
    agents: string[];
    profile: string;
    skills: boolean;
    gitignore: boolean;
    omo: boolean;
    aegis: boolean;
    global: boolean;
}

function createInterface(): readline.Interface {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

export async function interactiveMode(): Promise<InteractiveResult> {
    const rl = createInterface();

    try {
        console.log("");
        console.log(bold("  Welcome to agent-security-policies!"));
        console.log(dim("  Answer a few questions to set up security rules.\n"));

        // ── Scope: local or global ──
        console.log(bold("  Install scope:\n"));
        console.log(`    ${cyan("1)")} Local  — current project directory (.)`);
        console.log(`    ${cyan("2)")} Global — all your AI agents (system-wide)\n`);

        const scopeAnswer = await ask(rl, `  Select ${dim("[1]")}: `);
        const isGlobal = scopeAnswer.trim() === "2";

        let agents: string[];

        if (isGlobal) {
            // ── Global: detect and select agents ──
            console.log(dim("\n  Detecting installed agents...\n"));
            const detected = detectAgents();

            if (detected.length === 0) {
                // No agents detected — manual fallback
                console.log(dim("  No agents detected automatically. Select manually:\n"));
                SUPPORTED_AGENTS.forEach((agent, i) => {
                    console.log(`    ${cyan(`${i + 1})`)} ${agent.name} ${dim(`(${agent.description})`)}`);
                });
                const manualAnswer = await ask(
                    rl,
                    `\n  Select agents ${dim("(comma-separated numbers, Enter to cancel)")}: `
                );
                if (!manualAnswer.trim()) {
                    console.log(dim("  Cancelled.\n"));
                    return { agents: [], profile: "standard", skills: false, gitignore: false, omo: false, aegis: false, global: true };
                }
                const nums = manualAnswer.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
                agents = nums
                    .filter((n) => n >= 1 && n <= SUPPORTED_AGENTS.length)
                    .map((n) => SUPPORTED_AGENTS[n - 1].id);
            } else {
                // Show detected agents
                detected.forEach((agent, i) => {
                    console.log(`    ${cyan(`${i + 1})`)} ✅  ${agent.name} ${dim(`→ ${agent.globalDir(os.homedir())}`)}`);
                });
                const undetected = SUPPORTED_AGENTS.filter((a) => !detected.find((d) => d.id === a.id));
                undetected.forEach((agent) => {
                    console.log(`         ❌  ${agent.name} ${dim("(not detected)")}`);
                });

                const deselect = await ask(
                    rl,
                    `\n  Deselect any? ${dim("(comma-separated numbers, Enter to install all detected)")}: `
                );

                if (!deselect.trim()) {
                    agents = detected.map((a) => a.id);
                } else {
                    const removeNums = deselect.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
                    const removeIds = new Set(
                        removeNums
                            .filter((n) => n >= 1 && n <= detected.length)
                            .map((n) => detected[n - 1].id)
                    );
                    agents = detected.filter((a) => !removeIds.has(a.id)).map((a) => a.id);
                }
            }

            if (agents.length === 0) {
                console.log(dim("  No agents selected. Cancelled.\n"));
                return { agents: [], profile: "standard", skills: false, gitignore: false, omo: false, aegis: false, global: true };
            }
        } else {
            // ── Local: select agents (original flow) ──
            console.log(bold("\n  Available agents:\n"));
            SUPPORTED_AGENTS.forEach((agent, i) => {
                console.log(
                    `    ${cyan(`${i + 1})`)} ${agent.name} ${dim(`(${agent.description})`)}`
                );
            });
            console.log(
                `    ${cyan(`${SUPPORTED_AGENTS.length + 1})`)} ${bold("All agents")}\n`
            );

            const agentAnswer = await ask(
                rl,
                `  Select agents ${dim("(comma-separated numbers, e.g. 1,3)")}: `
            );

            const allIndex = SUPPORTED_AGENTS.length + 1;
            const nums = agentAnswer
                .split(",")
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n));

            if (nums.includes(allIndex) || agentAnswer.toLowerCase() === "all") {
                agents = SUPPORTED_AGENTS.map((a) => a.id);
            } else {
                agents = nums
                    .filter((n) => n >= 1 && n <= SUPPORTED_AGENTS.length)
                    .map((n) => SUPPORTED_AGENTS[n - 1].id);
            }

            if (agents.length === 0) {
                agents = SUPPORTED_AGENTS.map((a) => a.id);
                console.log(dim("  → No valid selection, defaulting to all agents\n"));
            }
        }

        // ── Select profile ──
        console.log(bold("\n  Profiles:\n"));
        PROFILES.forEach((p, i) => {
            console.log(`    ${cyan(`${i + 1})`)} ${p.id} ${dim(`— ${p.description}`)}`);
        });

        const profileAnswer = await ask(
            rl,
            `\n  Select profile ${dim("(1 or 2, default: 1)")}: `
        );
        const profileNum = parseInt(profileAnswer, 10);
        const profile =
            profileNum >= 1 && profileNum <= PROFILES.length
                ? PROFILES[profileNum - 1].id
                : "standard";

        // ── Install skills? ──
        console.log(bold("\n  Security skills available:\n"));
        SKILLS_LIST.forEach((s) => {
            console.log(
                `    ${cyan("•")} ${s.id} ${dim(`— ${s.tool}: ${s.description}`)}`
            );
        });

        const skillsAnswer = await ask(
            rl,
            `\n  Install security skills? ${dim("(Y/n)")}: `
        );
        const skills =
            skillsAnswer.toLowerCase() !== "n" && skillsAnswer.toLowerCase() !== "no";

        // ── Add to .gitignore? (local only) ──
        let gitignore = false;
        if (!isGlobal) {
            const gitignoreAnswer = await ask(
                rl,
                `\n  Add installed files to .gitignore? ${dim("(y/N)")}: `
            );
            gitignore =
                gitignoreAnswer.toLowerCase() === "y" ||
                gitignoreAnswer.toLowerCase() === "yes";
        }

        // ── Install Aegis? (OpenCode + oh-my-openagent) ──
        let omo = false;
        if (agents.includes("opencode")) {
            const omoDetected = detectOhMyOpenagent();
            if (omoDetected) {
                console.log(dim("\n  oh-my-openagent detected on this system."));
                const omoAnswer = await ask(
                    rl,
                    `  Install Aegis security agent for OpenCode (mode: all)? ${dim("(Y/n)")}: `
                );
                omo =
                    omoAnswer.toLowerCase() !== "n" && omoAnswer.toLowerCase() !== "no";
            } else {
                console.log(
                    dim("\n  oh-my-openagent not detected — skipping Aegis for OpenCode (use --omo to override).")
                );
            }
        }

        // ── Install Aegis for Claude Code? ──
        let aegis = false;
        if (agents.includes("claude")) {
            console.log(
                dim("\n  Claude Code supports Aegis as a subagent (.claude/agents/aegis.md).")
            );
            console.log(
                dim("  Aegis auto-delegates security tasks. Run `claude --agent aegis` for full-session coverage.")
            );
            const aegisAnswer = await ask(
                rl,
                `  Install Aegis security agent for Claude Code? ${dim("(y/N)")}: `
            );
            aegis =
                aegisAnswer.toLowerCase() === "y" || aegisAnswer.toLowerCase() === "yes";
        }

        console.log("");
        return { agents, profile, skills, gitignore, omo, aegis, global: isGlobal };
    } finally {
        rl.close();
    }
}
