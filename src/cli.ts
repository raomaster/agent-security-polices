#!/usr/bin/env node
// src/cli.ts — CLI entry point for agent-security-policies

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "./installer.js";
import { interactiveMode } from "./prompts.js";
import {
    SUPPORTED_AGENTS,
    SKILLS_LIST,
    COMMANDS_LIST,
    PROFILES,
    getAllAgentIds,
} from "./agents.js";
import { banner, info, err, bold, dim, cyan } from "./logger.js";

// ─── Version ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const VERSION: string = pkg.version;

// ─── Usage ──────────────────────────────────────────────────────────
export function showUsage(): void {
    banner();
    console.log(`  ${bold("Usage:")}  npx agent-security-policies [OPTIONS]\n`);
    console.log(`  ${bold("Options:")}`);
    console.log(`    --all                Install for all agents + security skills`);
    console.log(`    --agent <list>       Comma-separated: copilot,codex,claude,antigravity,opencode`);
    console.log(`    --skills             Also install security skills ${dim("(default: off)")}`);
    console.log(`    --profile <name>     standard ${dim("(~3K tokens)")} or lite ${dim("(~1K tokens)")} ${dim("(default: standard)")}`);
    console.log(`    --target <dir>       Target project directory ${dim("(default: .)")}`);
    console.log(`    --gitignore          Add installed files to .gitignore ${dim("(default: off)")}`);
    console.log(`    --omo                Install Aegis security agent ${dim("(OpenCode + oh-my-openagent)")}`);
    console.log(`    --list               Show available agents, profiles, and skills`);
    console.log(`    --version, -v        Show version`);
    console.log(`    --help, -h           Show this help`);
    console.log("");
    console.log(`  ${bold("Examples:")}`);
    console.log(`    npx agent-security-policies --all`);
    console.log(`    npx agent-security-policies --agent copilot,claude --skills`);
    console.log(`    npx agent-security-policies --agent opencode --skills --omo`);
    console.log(`    npx agent-security-policies --agent codex --target ./my-project`);
    console.log(`    npx agent-security-policies --all --profile lite`);
    console.log("");
}

// ─── List ───────────────────────────────────────────────────────────
export function showList(): void {
    banner();

    console.log(`  ${bold("Supported agents:")}\n`);
    for (const agent of SUPPORTED_AGENTS) {
        console.log(
            `    ${cyan(agent.id.padEnd(14))} ${agent.name} ${dim(`(${agent.description})`)}`
        );
    }

    console.log(`\n  ${bold("Profiles:")}\n`);
    for (const p of PROFILES) {
        console.log(`    ${cyan(p.id.padEnd(14))} ${p.description}`);
    }

    console.log(`\n  ${bold("Security skills:")}\n`);
    for (const s of SKILLS_LIST) {
        console.log(
            `    ${cyan(s.id.padEnd(18))} ${s.tool} — ${s.description}`
        );
    }

    console.log(`\n  ${bold("Security commands:")}\n`);
    for (const c of COMMANDS_LIST) {
        console.log(
            `    ${cyan(c.id.padEnd(18))} ${c.description}`
        );
    }
    console.log("");
}

// ─── Parse args ─────────────────────────────────────────────────────
interface ParsedArgs {
    all: boolean;
    agents: string[];
    skills: boolean;
    profile: string;
    target: string;
    gitignore: boolean;
    omo: boolean;
    help: boolean;
    version: boolean;
    list: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        all: false,
        agents: [],
        skills: false,
        profile: "standard",
        target: ".",
        gitignore: false,
        omo: false,
        help: false,
        version: false,
        list: false,
    };

    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];
        switch (arg) {
            case "--all":
                args.all = true;
                break;
            case "--agent":
                i++;
                if (i < argv.length) {
                    args.agents = argv[i]
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
                break;
            case "--skills":
                args.skills = true;
                break;
            case "--gitignore":
                args.gitignore = true;
                break;
            case "--omo":
                args.omo = true;
                break;
            case "--profile":
                i++;
                if (i < argv.length) {
                    args.profile = argv[i].trim();
                }
                break;
            case "--target":
                i++;
                if (i < argv.length) {
                    args.target = argv[i].trim();
                }
                break;
            case "--list":
                args.list = true;
                break;
            case "--help":
            case "-h":
                args.help = true;
                break;
            case "--version":
            case "-v":
                args.version = true;
                break;
            default:
                err(`Unknown option: ${arg}`);
                showUsage();
                process.exit(1);
        }
        i++;
    }

    return args;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const args = parseArgs(argv);

    if (args.version) {
        console.log(`agent-security-policies v${VERSION}`);
        process.exit(0);
    }

    if (args.help) {
        showUsage();
        process.exit(0);
    }

    if (args.list) {
        showList();
        process.exit(0);
    }

    // --all overrides agent list and enables skills
    if (args.all) {
        args.agents = getAllAgentIds();
        args.skills = true;
    }

    // No flags → interactive mode
    if (args.agents.length === 0 && !args.all) {
        banner();
        const result = await interactiveMode();
        args.agents = result.agents;
        args.profile = result.profile;
        args.skills = result.skills;
        args.gitignore = result.gitignore;
        args.omo = result.omo;
    }

    if (args.agents.length === 0) {
        err("No agents selected. Use --all or --agent <list>");
        showUsage();
        process.exit(1);
    }

    // Run installer
    banner();
    await install({
        agents: args.agents,
        profile: args.profile,
        skills: args.skills,
        target: args.target,
        gitignore: args.gitignore,
        omo: args.omo,
    });
}

main().catch((error: Error) => {
    err(`Fatal error: ${error.message}`);
    process.exit(1);
});
