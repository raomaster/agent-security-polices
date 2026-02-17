#!/usr/bin/env bash
# agent-security-policies installer
# Zero dependencies — requires only bash + curl (or local clone)
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash
#   curl -sSL https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.sh | bash -s -- --agent copilot,codex
#   ./install.sh --all
#   ./install.sh --agent copilot,codex,claude,antigravity --target /path/to/project

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────
REPO_URL="https://raw.githubusercontent.com/raomaster/agent-security-policies/main"
TARGET_DIR="."
AGENTS=""
ALL=false
VERBOSE=false
LOCAL_MODE=false

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
  --all                   Install for all supported agents
  --agent <list>          Comma-separated agent list: copilot,codex,claude,antigravity
  --target <dir>          Target project directory (default: current directory)
  --verbose               Show detailed output
  --help                  Show this help

Examples:
  install.sh --all
  install.sh --agent copilot,claude
  install.sh --agent codex --target ./my-project

Supported agents:
  copilot       GitHub Copilot (VS Code + JetBrains)
  codex         OpenAI Codex CLI
  claude        Claude CLI (Claude Code)
  antigravity   Google Antigravity (Gemini)
EOF
  exit 0
}

# ─── Parse args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)        ALL=true; shift ;;
    --agent)      AGENTS="$2"; shift 2 ;;
    --target)     TARGET_DIR="$2"; shift 2 ;;
    --verbose)    VERBOSE=true; shift ;;
    --help|-h)    usage ;;
    *)            err "Unknown option: $1"; usage ;;
  esac
done

if [[ "$ALL" == true ]]; then
  AGENTS="copilot,codex,claude,antigravity"
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

# AGENT_RULES.md
if [[ -f "$TARGET_DIR/AGENT_RULES.md" ]]; then
  warn "AGENT_RULES.md already exists — skipping (non-destructive)"
else
  fetch_file "AGENT_RULES.md" "$TARGET_DIR/AGENT_RULES.md"
  ok "AGENT_RULES.md"
fi

# policies/
mkdir -p "$TARGET_DIR/policies"
for policy in base_policy.yaml owasp_asvs.yaml owasp_masvs.yaml cwe_top25.yaml llm_security.yaml; do
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

Reference policies/ for detailed YAML security rulesets:
- policies/base_policy.yaml — 11 security domains
- policies/owasp_asvs.yaml — ASVS 5.0.0 (V1-V17)
- policies/cwe_top25.yaml — CWE/SANS Top 25 2025
- policies/llm_security.yaml — OWASP LLM Top 10 2025"

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

    *)
      warn "Unknown agent: $agent — skipping (supported: copilot, codex, claude, antigravity)"
      ;;
  esac
done

# ─── Summary ─────────────────────────────────────────────────────────
step "Done!"
echo ""
info "Files installed in: $TARGET_DIR"
info "Agents configured: $AGENTS"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Commit the new files to your repository"
echo "  2. Your AI agent will automatically detect the security rules"
echo "  3. Read AGENT_RULES.md for the full security ruleset"
echo ""
echo -e "${BLUE}Docs:${NC} https://github.com/raomaster/agent-security-policies"
