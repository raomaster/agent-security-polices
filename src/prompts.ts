// src/prompts.ts — Interactive mode (readline-based, zero dependencies)

import * as readline from "node:readline";
import { SUPPORTED_AGENTS, PROFILES, SKILLS_LIST } from "./agents.js";
import { detectOhMyOpenagent } from "./installer.js";
import { bold, cyan, dim } from "./logger.js";

interface InteractiveResult {
    agents: string[];
    profile: string;
    skills: boolean;
    gitignore: boolean;
    omo: boolean;
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
        console.log(
            dim("  Answer a few questions to set up security rules.\n")
        );

        // ── Select agents ──
        console.log(bold("  Available agents:\n"));
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

        let agents: string[];
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

        // ── Add to .gitignore? ──
        const gitignoreAnswer = await ask(
            rl,
            `\n  Add installed files to .gitignore? ${dim("(y/N)")}: `
        );
        const gitignore =
            gitignoreAnswer.toLowerCase() === "y" || gitignoreAnswer.toLowerCase() === "yes";

        // ── Install Aegis? (only if opencode selected + oh-my-openagent detected) ──
        let omo = false;
        if (agents.includes("opencode")) {
            const omoDetected = detectOhMyOpenagent();
            if (omoDetected) {
                console.log(dim("\n  oh-my-openagent detected on this system."));
                const omoAnswer = await ask(
                    rl,
                    `  Install Aegis security agent? ${dim("(Y/n)")}: `
                );
                omo =
                    omoAnswer.toLowerCase() !== "n" && omoAnswer.toLowerCase() !== "no";
            } else {
                console.log(dim("\n  oh-my-openagent not detected — skipping Aegis (use --omo to override)."));
            }
        }

        console.log("");
        return { agents, profile, skills, gitignore, omo };
    } finally {
        rl.close();
    }
}
