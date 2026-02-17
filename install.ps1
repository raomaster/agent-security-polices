# agent-security-policies installer (PowerShell)
# Zero dependencies - requires only PowerShell 5.1+ (built into Windows 10+)
#
# Usage:
#   irm https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.ps1 | iex
#   .\install.ps1 -All
#   .\install.ps1 -Agent copilot,codex,claude,antigravity
#   .\install.ps1 -Agent copilot,claude -Target C:\path\to\project

[CmdletBinding()]
param(
    [switch]$All,
    [string]$Agent = "",
    [string]$Target = ".",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# --- Config ---
$RepoUrl = "https://raw.githubusercontent.com/raomaster/agent-security-policies/main"

# --- Helpers ---
function Write-Info    { param([string]$Msg) Write-Host "  i " -ForegroundColor Blue -NoNewline; Write-Host $Msg }
function Write-Ok      { param([string]$Msg) Write-Host "  + " -ForegroundColor Green -NoNewline; Write-Host $Msg }
function Write-Warn    { param([string]$Msg) Write-Host "  ! " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }
function Write-Err     { param([string]$Msg) Write-Host "  X " -ForegroundColor Red -NoNewline; Write-Host $Msg }
function Write-Step    { param([string]$Msg) Write-Host "`n-- $Msg --" -ForegroundColor White }

function Show-Usage {
    Write-Host ""
    Write-Host "  agent-security-policies installer"
    Write-Host ""
    Write-Host "  Usage:"
    Write-Host "    install.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "  Options:"
    Write-Host "    -All                Install for all supported agents"
    Write-Host "    -Agent [list]       Comma-separated: copilot,codex,claude,antigravity"
    Write-Host "    -Target [dir]       Target project directory (default: current directory)"
    Write-Host "    -Help               Show this help"
    Write-Host ""
    Write-Host "  Examples:"
    Write-Host "    install.ps1 -All"
    Write-Host "    install.ps1 -Agent copilot,claude"
    Write-Host "    install.ps1 -Agent codex -Target .\my-project"
    Write-Host ""
    Write-Host "  Supported agents:"
    Write-Host "    copilot       GitHub Copilot (VS Code + JetBrains)"
    Write-Host "    codex         OpenAI Codex CLI"
    Write-Host "    claude        Claude CLI (Claude Code)"
    Write-Host "    antigravity   Google Antigravity (Gemini)"
    Write-Host ""
    exit 0
}

# --- Parse args ---
if ($Help) { Show-Usage }

if ($All) { $Agent = "copilot,codex,claude,antigravity" }

if ([string]::IsNullOrWhiteSpace($Agent)) {
    Write-Host "`n  agent-security-policies - Secure coding rules for AI agents`n"
    Write-Host "  No agents specified. Use -All or -Agent [list]`n"
    Show-Usage
}

$TargetDir = (Resolve-Path $Target).Path

# --- Detect source mode ---
$ScriptDir = $PSScriptRoot
$LocalMode = $false

if ($ScriptDir -and (Test-Path "$ScriptDir\AGENT_RULES.md")) {
    $LocalMode = $true
    Write-Info "Local mode - reading from $ScriptDir"
} else {
    Write-Info "Remote mode - downloading from GitHub"
}

# --- Fetch file helper ---
function Get-PolicyFile {
    param([string]$FileName, [string]$Dest)

    if ($LocalMode) {
        Copy-Item "$ScriptDir\$FileName" -Destination $Dest -Force
    } else {
        Invoke-RestMethod -Uri "$RepoUrl/$FileName" -OutFile $Dest
    }
}

# --- Shared instructions block ---
$InstructionsBlock = @"
Follow ALL security and code quality rules defined in AGENT_RULES.md.

Key mandatory rules:
- Apply OWASP ASVS 5.0.0 verification checklist to every change
- Prevent all CWE/SANS Top 25 2025 weaknesses
- Use typed exceptions - never bare except
- Never hardcode secrets (CWE-798)
- Validate all inputs at trust boundaries (CWE-20)
- shell=False in subprocess calls (CWE-78)
- Parameterized queries only - never concatenate SQL (CWE-89)
- Type hints + docstrings on all public APIs
- Structured logging with correlation IDs
- STRIDE threat model for new features

Reference policies/ for detailed YAML security rulesets:
- policies/base_policy.yaml - 11 security domains
- policies/owasp_asvs.yaml - ASVS 5.0.0 (V1-V17)
- policies/cwe_top25.yaml - CWE/SANS Top 25 2025
- policies/llm_security.yaml - OWASP LLM Top 10 2025
"@

# --- Step 1: Copy core files ---
Write-Step "Installing security policies to $TargetDir"

# AGENT_RULES.md
if (Test-Path "$TargetDir\AGENT_RULES.md") {
    Write-Warn "AGENT_RULES.md already exists - skipping (non-destructive)"
} else {
    Get-PolicyFile "AGENT_RULES.md" "$TargetDir\AGENT_RULES.md"
    Write-Ok "AGENT_RULES.md"
}

# policies/
$PoliciesDir = Join-Path $TargetDir "policies"
if (-not (Test-Path $PoliciesDir)) { New-Item -ItemType Directory -Path $PoliciesDir -Force | Out-Null }

$PolicyFiles = @("base_policy.yaml", "owasp_asvs.yaml", "owasp_masvs.yaml", "cwe_top25.yaml", "llm_security.yaml")
foreach ($policy in $PolicyFiles) {
    $dest = Join-Path $PoliciesDir $policy
    if (Test-Path $dest) {
        Write-Warn "policies/$policy already exists - skipping"
    } else {
        Get-PolicyFile "policies/$policy" $dest
        Write-Ok "policies/$policy"
    }
}

# --- Step 2: Generate agent-specific configs ---
$AgentList = $Agent -split ',' | ForEach-Object { $_.Trim() }

foreach ($ag in $AgentList) {
    switch ($ag) {

        # -- GitHub Copilot --
        "copilot" {
            Write-Step "Configuring GitHub Copilot"
            $ghDir = Join-Path $TargetDir ".github"
            $copilotFile = Join-Path $ghDir "copilot-instructions.md"
            if (-not (Test-Path $ghDir)) { New-Item -ItemType Directory -Path $ghDir -Force | Out-Null }

            if (Test-Path $copilotFile) {
                $content = Get-Content $copilotFile -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match "AGENT_RULES\.md") {
                    Write-Warn ".github/copilot-instructions.md already references AGENT_RULES.md - skipping"
                } else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n$InstructionsBlock"
                    Add-Content -Path $copilotFile -Value $appendText
                    Write-Ok ".github/copilot-instructions.md - appended security rules"
                }
            } else {
                $copilotContent = "# Security Policy Instructions`n`n$InstructionsBlock"
                Set-Content -Path $copilotFile -Value $copilotContent
                Write-Ok ".github/copilot-instructions.md - created"
            }
        }

        # -- Codex CLI --
        "codex" {
            Write-Step "Configuring Codex CLI"
            $codexFile = Join-Path $TargetDir "AGENTS.md"

            if (Test-Path $codexFile) {
                $content = Get-Content $codexFile -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match "AGENT_RULES\.md") {
                    Write-Warn "AGENTS.md already references AGENT_RULES.md - skipping"
                } else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n## Security Policy`n`n$InstructionsBlock"
                    Add-Content -Path $codexFile -Value $appendText
                    Write-Ok "AGENTS.md - appended security rules"
                }
            } else {
                $codexContent = "# Project Agent Instructions`n`n## Security Policy`n`n$InstructionsBlock"
                Set-Content -Path $codexFile -Value $codexContent
                Write-Ok "AGENTS.md - created"
            }
        }

        # -- Claude CLI --
        "claude" {
            Write-Step "Configuring Claude CLI"
            $claudeFile = Join-Path $TargetDir "CLAUDE.md"

            if (Test-Path $claudeFile) {
                $content = Get-Content $claudeFile -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match "AGENT_RULES\.md") {
                    Write-Warn "CLAUDE.md already references AGENT_RULES.md - skipping"
                } else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n## Security Policy`n`n$InstructionsBlock"
                    Add-Content -Path $claudeFile -Value $appendText
                    Write-Ok "CLAUDE.md - appended security rules"
                }
            } else {
                $claudeContent = "# Project Instructions`n`n## Security Policy`n`n$InstructionsBlock"
                Set-Content -Path $claudeFile -Value $claudeContent
                Write-Ok "CLAUDE.md - created"
            }
        }

        # -- Antigravity --
        "antigravity" {
            Write-Step "Configuring Antigravity (Gemini)"
            $rulesDir = Join-Path $TargetDir ".agent\rules"
            $agFile = Join-Path $rulesDir "security.md"
            if (-not (Test-Path $rulesDir)) { New-Item -ItemType Directory -Path $rulesDir -Force | Out-Null }

            if (Test-Path $agFile) {
                Write-Warn ".agent/rules/security.md already exists - skipping"
            } else {
                $agContent = @"
---
description: Security policy - OWASP ASVS, CWE Top 25, NIST SSDF
alwaysApply: true
---

$InstructionsBlock
"@
                Set-Content -Path $agFile -Value $agContent
                Write-Ok ".agent/rules/security.md - created (always-on rule)"
            }
        }

        default {
            Write-Warn "Unknown agent: $ag - skipping (supported: copilot, codex, claude, antigravity)"
        }
    }
}

# --- Summary ---
Write-Step "Done!"
Write-Host ""
Write-Info "Files installed in: $TargetDir"
Write-Info "Agents configured: $Agent"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    1. Commit the new files to your repository"
Write-Host "    2. Your AI agent will automatically detect the security rules"
Write-Host "    3. Read AGENT_RULES.md for the full security ruleset"
Write-Host ""
Write-Host "  Docs: " -NoNewline
Write-Host "https://github.com/raomaster/agent-security-policies" -ForegroundColor Blue
