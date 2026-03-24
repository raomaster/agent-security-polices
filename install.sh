#!/usr/bin/env bash
# agent-security-policies installer
# Zero dependencies — requires only bash + curl (or local clone)
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash
#   curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --agent copilot,codex
#   ./install.sh --all
#   ./install.sh --agent copilot,codex,claude,antigravity,opencode --target /path/to/project
#   ./install.sh --agent opencode --skills --omo

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────
REPO_URL="https://raw.githubusercontent.com/raomaster/agent-security-policies/main"
TARGET_DIR="."
AGENTS=""
ALL=false
VERBOSE=false
LOCAL_MODE=false
INSTALL_SKILLS=false
INSTALL_GITIGNORE=false
INSTALL_OMO=false
PROFILE="standard"
SKILLS_LIST="sast-scan secrets-scan dependency-scan container-scan iac-scan threat-model fix-findings security-review"
COMMANDS_LIST="security-review checkpoint rollback"

# ─── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────────────
info()  { echo -e "${BLUE}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1" >&2; }
step()  { echo -e "\n${BOLD}── $1 ──${NC}"; }

usage() {
  cat <<EOF
${BOLD}agent-security-policies installer${NC}

Usage:
  install.sh [OPTIONS]

Options:
  --all                   Install for all supported agents (includes skills)
  --agent <list>          Comma-separated agent list: copilot,codex,claude,antigravity,opencode
  --skills                Also install security skills and commands
  --profile <name>        Rule profile: standard (~3K tokens) or lite (~1K tokens)
  --target <dir>          Target project directory (default: current directory)
  --gitignore             Add installed files to .gitignore
  --omo                   Install Aegis security agent (requires --agent opencode)
  --verbose               Show detailed output
  --help                  Show this help

Examples:
  install.sh --all
  install.sh --all --skills
  install.sh --agent copilot,claude --skills
  install.sh --agent opencode --skills --omo
  install.sh --agent codex --target ./my-project
  install.sh --all --profile lite --gitignore

Supported agents:
  copilot       GitHub Copilot (VS Code + JetBrains)
  codex         OpenAI Codex CLI
  claude        Claude CLI (Claude Code)
  antigravity   Google Antigravity (Gemini)
  opencode      OpenCode (oh-my-openagent compatible)

Skills (use --skills to install):
  sast-scan         Semgrep — CWE code vulnerabilities
  secrets-scan      Gitleaks — hardcoded credentials
  dependency-scan   Trivy fs — CVE in dependencies
  container-scan    Trivy image — CVE in containers
  iac-scan          KICS — IaC misconfigurations
  threat-model      STRIDE threat modeling (agent-only)
  fix-findings      Remediate findings from any scan
  security-review   Multi-phase code review (no Docker)

Commands (installed with --skills):
  security-review   Full security review orchestration
  checkpoint        Create a labeled git stash before risky changes
  rollback          Revert to a previous checkpoint
EOF
  exit 0
}

# ─── Parse args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)        ALL=true; shift ;;
    --agent)      AGENTS="$2"; shift 2 ;;
    --skills)     INSTALL_SKILLS=true; shift ;;
    --profile)    PROFILE="$2"; shift 2 ;;
    --target)     TARGET_DIR="$2"; shift 2 ;;
    --gitignore)  INSTALL_GITIGNORE=true; shift ;;
    --omo)        INSTALL_OMO=true; shift ;;
    --verbose)    VERBOSE=true; shift ;;
    --help|-h)    usage ;;
    *)            err "Unknown option: $1"; usage ;;
  esac
done

if [[ "$PROFILE" != "standard" && "$PROFILE" != "lite" ]]; then
  err "Invalid --profile value: $PROFILE (supported: standard, lite)"
  exit 1
fi

if [[ "$ALL" == true ]]; then
  AGENTS="copilot,codex,claude,antigravity,opencode"
  INSTALL_SKILLS=true
fi

if [[ -z "$AGENTS" ]]; then
  echo -e "${BOLD}agent-security-policies${NC} — Secure coding rules for AI agents\n"
  echo "No agents specified. Use --all or --agent <list>"
  echo ""
  usage
fi

TARGET_DIR=$(cd "$TARGET_DIR" && pwd)

# ─── Detect source mode ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/AGENT_RULES.md" ]]; then
  LOCAL_MODE=true
  SOURCE_DIR="$SCRIPT_DIR"
  info "Local mode — reading from $SOURCE_DIR"
else
  info "Remote mode — downloading from GitHub"
fi

# ─── Fetch file helper ───────────────────────────────────────────────
fetch_file() {
  local filename="$1"
  local dest="$2"

  if [[ "$LOCAL_MODE" == true ]]; then
    cp "$SOURCE_DIR/$filename" "$dest"
  else
    curl -sSL "$REPO_URL/$filename" -o "$dest"
  fi
}

# ─── Step 1: Copy core files ─────────────────────────────────────────
step "Installing security policies to $TARGET_DIR"

# AGENT_RULES.md (standard or lite based on profile)
if [[ "$PROFILE" == "lite" ]]; then
  RULES_FILE="AGENT_RULES_LITE.md"
  RULES_DEST="AGENT_RULES_LITE.md"
else
  RULES_FILE="AGENT_RULES.md"
  RULES_DEST="AGENT_RULES.md"
fi

if [[ -f "$TARGET_DIR/$RULES_DEST" ]]; then
  warn "$RULES_DEST already exists — skipping (non-destructive)"
else
  fetch_file "$RULES_FILE" "$TARGET_DIR/$RULES_DEST"
  ok "$RULES_DEST (profile: $PROFILE)"
fi

# Also copy full rules if installing lite (for reference)
if [[ "$PROFILE" == "lite" && ! -f "$TARGET_DIR/AGENT_RULES.md" ]]; then
  fetch_file "AGENT_RULES.md" "$TARGET_DIR/AGENT_RULES.md"
  ok "AGENT_RULES.md (full reference)"
fi

# policies/
mkdir -p "$TARGET_DIR/policies"
for policy in base_policy.yaml owasp_asvs.yaml owasp_masvs.yaml cwe_top25.yaml llm_security.yaml owasp_proactive_controls.yaml; do
  if [[ -f "$TARGET_DIR/policies/$policy" ]]; then
    warn "policies/$policy already exists — skipping"
  else
    fetch_file "policies/$policy" "$TARGET_DIR/policies/$policy"
    ok "policies/$policy"
  fi
done

# ─── Step 2: Generate agent-specific configs ─────────────────────────

# Read AGENT_RULES.md content for inline injection
RULES_CONTENT=$(cat "$TARGET_DIR/AGENT_RULES.md")

# Shared instruction block (compact, under 2K tokens)
INSTRUCTIONS_BLOCK="Follow ALL security and code quality rules defined in AGENT_RULES.md.

Key mandatory rules:
- Apply OWASP ASVS 5.0.0 verification checklist to every change
- Prevent all CWE/SANS Top 25 2025 weaknesses
- Use typed exceptions — never bare except
- Never hardcode secrets (CWE-798)
- Validate all inputs at trust boundaries (CWE-20)
- shell=False in subprocess calls (CWE-78)
- Parameterized queries only — never concatenate SQL (CWE-89)
- Type hints + docstrings on all public APIs
- Structured logging with correlation IDs
- STRIDE threat model for new features
- Apply OWASP Proactive Controls 2024 (C1-C10) to every new feature

Reference policies/ for detailed YAML security rulesets:
- policies/base_policy.yaml — 11 security domains
- policies/owasp_asvs.yaml — ASVS 5.0.0 (V1-V17)
- policies/cwe_top25.yaml — CWE/SANS Top 25 2025
- policies/llm_security.yaml — OWASP LLM Top 10 2025
- policies/owasp_proactive_controls.yaml — OWASP Proactive Controls 2024 (C1-C10)"

IFS=',' read -ra AGENT_LIST <<< "$AGENTS"
for agent in "${AGENT_LIST[@]}"; do
  agent=$(echo "$agent" | xargs) # trim whitespace

  case "$agent" in

    # ── GitHub Copilot ───────────────────────────────────────────────
    copilot)
      step "Configuring GitHub Copilot"
      COPILOT_FILE="$TARGET_DIR/.github/copilot-instructions.md"
      mkdir -p "$TARGET_DIR/.github"

      if [[ -f "$COPILOT_FILE" ]]; then
        if grep -q "AGENT_RULES.md" "$COPILOT_FILE" 2>/dev/null; then
          warn ".github/copilot-instructions.md already references AGENT_RULES.md — skipping"
        else
          # Append to existing file
          echo -e "\n\n<!-- agent-security-policies -->\n$INSTRUCTIONS_BLOCK" >> "$COPILOT_FILE"
          ok ".github/copilot-instructions.md — appended security rules"
        fi
      else
        cat > "$COPILOT_FILE" <<COPILOT_EOF
# Security Policy Instructions

$INSTRUCTIONS_BLOCK
COPILOT_EOF
        ok ".github/copilot-instructions.md — created"
      fi
      ;;

    # ── Codex CLI ────────────────────────────────────────────────────
    codex)
      step "Configuring Codex CLI"
      CODEX_FILE="$TARGET_DIR/AGENTS.md"

      if [[ -f "$CODEX_FILE" ]]; then
        if grep -q "AGENT_RULES.md" "$CODEX_FILE" 2>/dev/null; then
          warn "AGENTS.md already references AGENT_RULES.md — skipping"
        else
          echo -e "\n\n<!-- agent-security-policies -->\n## Security Policy\n\n$INSTRUCTIONS_BLOCK" >> "$CODEX_FILE"
          ok "AGENTS.md — appended security rules"
        fi
      else
        cat > "$CODEX_FILE" <<CODEX_EOF
# Project Agent Instructions

## Security Policy

$INSTRUCTIONS_BLOCK
CODEX_EOF
        ok "AGENTS.md — created"
      fi
      ;;

    # ── Claude CLI ───────────────────────────────────────────────────
    claude)
      step "Configuring Claude CLI"
      CLAUDE_FILE="$TARGET_DIR/CLAUDE.md"

      if [[ -f "$CLAUDE_FILE" ]]; then
        if grep -q "AGENT_RULES.md" "$CLAUDE_FILE" 2>/dev/null; then
          warn "CLAUDE.md already references AGENT_RULES.md — skipping"
        else
          echo -e "\n\n<!-- agent-security-policies -->\n## Security Policy\n\n$INSTRUCTIONS_BLOCK" >> "$CLAUDE_FILE"
          ok "CLAUDE.md — appended security rules"
        fi
      else
        cat > "$CLAUDE_FILE" <<CLAUDE_EOF
# Project Instructions

## Security Policy

$INSTRUCTIONS_BLOCK
CLAUDE_EOF
        ok "CLAUDE.md — created"
      fi
      ;;

    # ── Antigravity ──────────────────────────────────────────────────
    antigravity)
      step "Configuring Antigravity (Gemini)"
      RULES_DIR="$TARGET_DIR/.agent/rules"
      ANTIGRAVITY_FILE="$RULES_DIR/security.md"
      mkdir -p "$RULES_DIR"

      if [[ -f "$ANTIGRAVITY_FILE" ]]; then
        warn ".agent/rules/security.md already exists — skipping"
      else
        cat > "$ANTIGRAVITY_FILE" <<ANTIGRAVITY_EOF
---
description: Security policy — OWASP ASVS, CWE Top 25, NIST SSDF
alwaysApply: true
---

$INSTRUCTIONS_BLOCK
ANTIGRAVITY_EOF
        ok ".agent/rules/security.md — created (always-on rule)"
      fi
      ;;

    # ── OpenCode ─────────────────────────────────────────────────────
    opencode)
      step "Configuring OpenCode"
      OPENCODE_RULES_DIR="$TARGET_DIR/.claude/rules"
      OPENCODE_FILE="$OPENCODE_RULES_DIR/security.md"
      mkdir -p "$OPENCODE_RULES_DIR"
      mkdir -p "$TARGET_DIR/.opencode/skills"
      mkdir -p "$TARGET_DIR/.opencode/command"

      if [[ -f "$OPENCODE_FILE" ]]; then
        if grep -q "AGENT_RULES.md" "$OPENCODE_FILE" 2>/dev/null; then
          warn ".claude/rules/security.md already references AGENT_RULES.md — skipping"
        else
          echo -e "\n\n<!-- agent-security-policies -->\n$INSTRUCTIONS_BLOCK" >> "$OPENCODE_FILE"
          ok ".claude/rules/security.md — appended security rules"
        fi
      else
        cat > "$OPENCODE_FILE" <<OPENCODE_EOF
---
description: Security policy — OWASP ASVS 5.0.0, CWE Top 25 2025, NIST SSDF, OWASP Proactive Controls 2024
alwaysApply: true
---

$INSTRUCTIONS_BLOCK
OPENCODE_EOF
        ok ".claude/rules/security.md — created (always-on rule)"
      fi

      # Install Aegis agent if --omo
      # OpenCode discovers agents from .opencode/agents/ (per-project)
      if [[ "$INSTALL_OMO" == true ]]; then
        AEGIS_DIR="$TARGET_DIR/.opencode/agents"
        AEGIS_FILE="$AEGIS_DIR/aegis.md"
        mkdir -p "$AEGIS_DIR"
        if [[ -f "$AEGIS_FILE" ]]; then
          warn ".opencode/agents/aegis.md already exists — skipping"
        else
          fetch_file ".opencode/agents/aegis.md" "$AEGIS_FILE" 2>/dev/null || {
            # Generate inline if remote fetch fails (local mode or not yet pushed)
            cat > "$AEGIS_FILE" <<'AEGIS_EOF'
---
name: Aegis
description: Security specialist agent. Runs security scans, reviews code for vulnerabilities, applies OWASP/CWE/NIST standards, and fixes findings. Delegate security-related tasks here.
model: sonnet
mode: all
tools:
  - Bash
  - Glob
  - Grep
  - Read
  - Edit
  - Write
  - WebFetch
  - TodoWrite
---

# Aegis — Security Specialist Agent

You are **Aegis**, a security specialist AI agent built on `agent-security-policies`.

## Your Mission

Systematically find and fix security vulnerabilities in code, infrastructure, and AI agent behavior. Enforce OWASP, CWE/SANS, NIST, and Proactive Controls standards on every task.

## Working Method

1. Read AGENT_RULES.md before any task
2. Use /checkpoint before making changes
3. Select skill(s) for the request
4. Execute following SKILL.md instructions
5. Triage: CRITICAL → HIGH → MEDIUM → LOW → INFO
6. Apply fixes with fix-findings skill
7. Re-scan to verify
8. Report with CWE/CVE/OWASP mapping

## Git Safety Rules

Never force push. Never --no-verify. Never `git add -A` blindly. Never modify git config. Never commit .env. See Rule 12 in AGENT_RULES.md.
AEGIS_EOF
          }
          ok ".opencode/agents/aegis.md — Aegis security agent installed"
        fi
      fi
      ;;

    *)
      warn "Unknown agent: $agent — skipping (supported: copilot, codex, claude, antigravity, opencode)"
      ;;
  esac
done

# ─── Step 3: Install skills if requested ──────────────────────────────
if [[ "$INSTALL_SKILLS" == true ]]; then
  step "Installing security skills"

  # Copy skills/ directory
  mkdir -p "$TARGET_DIR/skills"
  for skill in $SKILLS_LIST; do
    mkdir -p "$TARGET_DIR/skills/$skill"
    if [[ -f "$TARGET_DIR/skills/$skill/SKILL.md" ]]; then
      warn "skills/$skill/SKILL.md already exists — skipping"
    else
      fetch_file "skills/$skill/SKILL.md" "$TARGET_DIR/skills/$skill/SKILL.md"
      ok "skills/$skill/SKILL.md"
    fi
  done

  # Copy commands/ directory
  step "Installing security commands"
  mkdir -p "$TARGET_DIR/commands"
  for cmd in $COMMANDS_LIST; do
    if [[ -f "$TARGET_DIR/commands/$cmd.md" ]]; then
      warn "commands/$cmd.md already exists — skipping"
    else
      fetch_file "commands/$cmd.md" "$TARGET_DIR/commands/$cmd.md"
      ok "commands/$cmd.md"
    fi
  done

  # Install skills per agent
  for agent in "${AGENT_LIST[@]}"; do
    agent=$(echo "$agent" | xargs)
    case "$agent" in

      # Antigravity — native SKILL.md format
      antigravity)
        step "Installing skills for Antigravity"
        for skill in $SKILLS_LIST; do
          SKILL_DIR="$TARGET_DIR/.agent/skills/$skill"
          mkdir -p "$SKILL_DIR"
          if [[ -f "$SKILL_DIR/SKILL.md" ]]; then
            warn ".agent/skills/$skill/SKILL.md already exists — skipping"
          else
            cp "$TARGET_DIR/skills/$skill/SKILL.md" "$SKILL_DIR/SKILL.md"
            ok ".agent/skills/$skill/SKILL.md"
          fi
        done
        ;;

      # Claude CLI — slash commands
      claude)
        step "Installing skills for Claude CLI"
        mkdir -p "$TARGET_DIR/.claude/commands"
        for skill in $SKILLS_LIST; do
          CMD_FILE="$TARGET_DIR/.claude/commands/$skill.md"
          if [[ -f "$CMD_FILE" ]]; then
            warn ".claude/commands/$skill.md already exists — skipping"
          else
            # Strip YAML frontmatter for Claude CLI format
            sed '1{/^---$/d}; /^---$/,/^---$/d' "$TARGET_DIR/skills/$skill/SKILL.md" > "$CMD_FILE"
            ok ".claude/commands/$skill.md"
          fi
        done
        # Also install user-invocable commands for Claude
        for cmd in $COMMANDS_LIST; do
          CMD_FILE="$TARGET_DIR/.claude/commands/$cmd.md"
          if [[ -f "$CMD_FILE" ]]; then
            warn ".claude/commands/$cmd.md already exists — skipping"
          else
            sed '1{/^---$/d}; /^---$/,/^---$/d' "$TARGET_DIR/commands/$cmd.md" > "$CMD_FILE"
            ok ".claude/commands/$cmd.md"
          fi
        done
        ;;

      # Copilot — prompt files
      copilot)
        step "Installing skills for Copilot"
        mkdir -p "$TARGET_DIR/.github/prompts"
        for skill in $SKILLS_LIST; do
          PROMPT_FILE="$TARGET_DIR/.github/prompts/$skill.prompt.md"
          if [[ -f "$PROMPT_FILE" ]]; then
            warn ".github/prompts/$skill.prompt.md already exists — skipping"
          else
            # Strip YAML frontmatter for Copilot prompt format
            sed '1{/^---$/d}; /^---$/,/^---$/d' "$TARGET_DIR/skills/$skill/SKILL.md" > "$PROMPT_FILE"
            ok ".github/prompts/$skill.prompt.md"
          fi
        done
        # Also install user-invocable commands for Copilot
        for cmd in $COMMANDS_LIST; do
          PROMPT_FILE="$TARGET_DIR/.github/prompts/$cmd.prompt.md"
          if [[ -f "$PROMPT_FILE" ]]; then
            warn ".github/prompts/$cmd.prompt.md already exists — skipping"
          else
            sed '1{/^---$/d}; /^---$/,/^---$/d' "$TARGET_DIR/commands/$cmd.md" > "$PROMPT_FILE"
            ok ".github/prompts/$cmd.prompt.md"
          fi
        done
        ;;

      # Codex CLI — append to AGENTS.md
      codex)
        step "Installing skills for Codex CLI"
        CODEX_FILE="$TARGET_DIR/AGENTS.md"
        for skill in $SKILLS_LIST; do
          if grep -q "skill:$skill" "$CODEX_FILE" 2>/dev/null; then
            warn "AGENTS.md already contains $skill skill — skipping"
          else
            echo -e "\n<!-- skill:$skill -->" >> "$CODEX_FILE"
            sed '1{/^---$/d}; /^---$/,/^---$/d' "$TARGET_DIR/skills/$skill/SKILL.md" >> "$CODEX_FILE"
            ok "AGENTS.md — appended $skill skill"
          fi
        done
        ;;

      # OpenCode — native SKILL.md format in .opencode/skills + commands in .opencode/command
      opencode)
        step "Installing skills for OpenCode"
        for skill in $SKILLS_LIST; do
          SKILL_DIR="$TARGET_DIR/.opencode/skills/$skill"
          mkdir -p "$SKILL_DIR"
          if [[ -f "$SKILL_DIR/SKILL.md" ]]; then
            warn ".opencode/skills/$skill/SKILL.md already exists — skipping"
          else
            cp "$TARGET_DIR/skills/$skill/SKILL.md" "$SKILL_DIR/SKILL.md"
            ok ".opencode/skills/$skill/SKILL.md"
          fi
        done
        step "Installing commands for OpenCode"
        for cmd in $COMMANDS_LIST; do
          CMD_FILE="$TARGET_DIR/.opencode/command/$cmd.md"
          if [[ -f "$CMD_FILE" ]]; then
            warn ".opencode/command/$cmd.md already exists — skipping"
          else
            cp "$TARGET_DIR/commands/$cmd.md" "$CMD_FILE"
            ok ".opencode/command/$cmd.md"
          fi
        done
        ;;
    esac
  done
fi

# ─── Step 4: .gitignore ───────────────────────────────────────────────
if [[ "$INSTALL_GITIGNORE" == true ]]; then
  step "Adding installed files to .gitignore"

  MARKER_START="# >>> agent-security-policies >>>"
  MARKER_END="# <<< agent-security-policies <<<"
  GITIGNORE_FILE="$TARGET_DIR/.gitignore"

  # Build entries
  ENTRIES="AGENT_RULES.md"
  [[ "$PROFILE" == "lite" ]] && ENTRIES="$ENTRIES
AGENT_RULES_LITE.md"
  ENTRIES="$ENTRIES
policies/"

  # Agent config paths
  for agent in "${AGENT_LIST[@]}"; do
    agent=$(echo "$agent" | xargs)
    case "$agent" in
      copilot)     ENTRIES="$ENTRIES
.github/copilot-instructions.md" ;;
      codex)       ENTRIES="$ENTRIES
AGENTS.md" ;;
      claude)      ENTRIES="$ENTRIES
CLAUDE.md" ;;
      antigravity) ENTRIES="$ENTRIES
.agent/rules/security.md" ;;
      opencode)    ENTRIES="$ENTRIES
.claude/rules/security.md
.opencode/agents/" ;;
    esac
  done

  # Skills/commands directories
  if [[ "$INSTALL_SKILLS" == true ]]; then
    ENTRIES="$ENTRIES
skills/
commands/"
    for agent in "${AGENT_LIST[@]}"; do
      agent=$(echo "$agent" | xargs)
      case "$agent" in
        antigravity) ENTRIES="$ENTRIES
.agent/skills/" ;;
        claude)      ENTRIES="$ENTRIES
.claude/commands/" ;;
        copilot)     ENTRIES="$ENTRIES
.github/prompts/" ;;
        opencode)    ENTRIES="$ENTRIES
.opencode/skills/
.opencode/command/" ;;
      esac
    done
  fi

  BLOCK="$MARKER_START
$ENTRIES
$MARKER_END"

  if [[ -f "$GITIGNORE_FILE" ]]; then
    if grep -q "$MARKER_START" "$GITIGNORE_FILE" 2>/dev/null; then
      # Replace existing block using Python (portable awk alternative)
      python3 -c "
import sys
content = open('$GITIGNORE_FILE').read()
start = content.find('$MARKER_START')
end = content.find('$MARKER_END')
if start != -1 and end != -1:
    new = content[:start] + '''$BLOCK''' + content[end+len('$MARKER_END'):]
    open('$GITIGNORE_FILE', 'w').write(new)
"
      ok ".gitignore — updated existing block"
    else
      # Append block
      echo "" >> "$GITIGNORE_FILE"
      echo "$BLOCK" >> "$GITIGNORE_FILE"
      ok ".gitignore — appended entries"
    fi
  else
    echo "$BLOCK" > "$GITIGNORE_FILE"
    ok ".gitignore — created"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────
step "Done!"
echo ""
info "Files installed in: $TARGET_DIR"
info "Agents configured: $AGENTS"
info "Profile: $PROFILE"
[[ "$INSTALL_SKILLS" == true ]] && info "Skills installed: $(echo $SKILLS_LIST | tr ' ' ', ')"
[[ "$INSTALL_SKILLS" == true ]] && info "Commands installed: $(echo $COMMANDS_LIST | tr ' ' ', ')"
[[ "$INSTALL_OMO" == true ]] && info "Aegis security agent installed (.opencode/agents/aegis.md)"
[[ "$INSTALL_GITIGNORE" == true ]] && info "Installed files added to .gitignore"
echo ""
echo -e "${BOLD}Next steps:${NC}"
[[ "$INSTALL_GITIGNORE" == true ]] && echo "  1. Commit the updated .gitignore to your repository" || echo "  1. Commit the new files to your repository"
echo "  2. Your AI agent will automatically detect the security rules"
echo "  3. Read AGENT_RULES.md for the full security ruleset"
[[ "$INSTALL_SKILLS" == true ]] && echo "  4. Try a skill: ask your agent to run sast-scan or threat-model"
[[ "$INSTALL_OMO" == true ]] && echo "  5. Delegate security tasks to Aegis: ask your agent to invoke Aegis"
echo ""
echo -e "${BLUE}Docs:${NC} https://github.com/raomaster/agent-security-policies"
