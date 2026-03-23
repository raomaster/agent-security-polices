# agent-security-policies installer (PowerShell)
# Zero dependencies - requires only PowerShell 5.1+ (built into Windows 10+)
#
# Usage:
#   irm https://raw.githubusercontent.com/raomaster/agent-security-policies/main/install.ps1 | iex
#   .\install.ps1 -All
#   .\install.ps1 -All -Skills
#   .\install.ps1 -Agent copilot,codex,claude,antigravity,opencode
#   .\install.ps1 -Agent opencode -Skills -Omo
#   .\install.ps1 -Agent copilot,claude -Target C:\path\to\project
#   .\install.ps1 -All -Profile lite -Gitignore

[CmdletBinding()]
param(
    [switch]$All,
    [string]$Agent = "",
    [switch]$Skills,
    [ValidateSet("standard", "lite")]
    [Alias("Profile")]
    [string]$RuleProfile = "standard",
    [string]$Target = ".",
    [switch]$Gitignore,
    [switch]$Omo,
    [switch]$Help
)

$SkillsList = @("sast-scan", "secrets-scan", "dependency-scan", "container-scan", "iac-scan", "threat-model", "fix-findings", "security-review")
$CommandsList = @("security-review", "checkpoint", "rollback")

$ErrorActionPreference = "Stop"

# --- Config ---
$RepoUrl = "https://raw.githubusercontent.com/raomaster/agent-security-policies/main"

# --- Helpers ---
function Write-Info { param([string]$Msg) Write-Host "  i " -ForegroundColor Blue -NoNewline; Write-Host $Msg }
function Write-Ok { param([string]$Msg) Write-Host "  + " -ForegroundColor Green -NoNewline; Write-Host $Msg }
function Write-Warn { param([string]$Msg) Write-Host "  ! " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }
function Write-Err { param([string]$Msg) Write-Host "  X " -ForegroundColor Red -NoNewline; Write-Host $Msg }
function Write-Step { param([string]$Msg) Write-Host "`n-- $Msg --" -ForegroundColor White }

function Show-Usage {
    Write-Host ""
    Write-Host "  agent-security-policies installer"
    Write-Host ""
    Write-Host "  Usage:"
    Write-Host "    install.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "  Options:"
    Write-Host "    -All                Install for all supported agents (includes skills)"
    Write-Host "    -Agent [list]       Comma-separated: copilot,codex,claude,antigravity,opencode"
    Write-Host "    -Skills             Also install security skills and commands"
    Write-Host "    -Profile [name]     Rule profile: standard (~3K tokens) or lite (~1K tokens)"
    Write-Host "    -Target [dir]       Target project directory (default: current directory)"
    Write-Host "    -Gitignore          Add installed files to .gitignore"
    Write-Host "    -Omo                Install Aegis security agent (requires -Agent opencode)"
    Write-Host "    -Help               Show this help"
    Write-Host ""
    Write-Host "  Examples:"
    Write-Host "    install.ps1 -All"
    Write-Host "    install.ps1 -All -Skills"
    Write-Host "    install.ps1 -Agent copilot,claude -Skills"
    Write-Host "    install.ps1 -Agent opencode -Skills -Omo"
    Write-Host "    install.ps1 -Agent codex -Target .\my-project"
    Write-Host "    install.ps1 -All -Profile lite -Gitignore"
    Write-Host ""
    Write-Host "  Supported agents:"
    Write-Host "    copilot       GitHub Copilot (VS Code + JetBrains)"
    Write-Host "    codex         OpenAI Codex CLI"
    Write-Host "    claude        Claude CLI (Claude Code)"
    Write-Host "    antigravity   Google Antigravity (Gemini)"
    Write-Host "    opencode      OpenCode (oh-my-openagent compatible)"
    Write-Host ""
    Write-Host "  Skills (use -Skills to install):"
    Write-Host "    sast-scan         Semgrep - CWE code vulnerabilities"
    Write-Host "    secrets-scan      Gitleaks - hardcoded credentials"
    Write-Host "    dependency-scan   Trivy fs - CVE in dependencies"
    Write-Host "    container-scan    Trivy image - CVE in containers"
    Write-Host "    iac-scan          KICS - IaC misconfigurations"
    Write-Host "    threat-model      STRIDE threat modeling (agent-only)"
    Write-Host "    fix-findings      Remediate findings from any scan"
    Write-Host "    security-review   Multi-phase code review (no Docker)"
    Write-Host ""
    Write-Host "  Commands (installed with -Skills):"
    Write-Host "    security-review   Full security review orchestration"
    Write-Host "    checkpoint        Create a labeled git stash before risky changes"
    Write-Host "    rollback          Revert to a previous checkpoint"
    Write-Host ""
    exit 0
}

# --- Parse args ---
if ($Help) { Show-Usage }

if ($All) {
    $Agent = "copilot,codex,claude,antigravity,opencode"
    $Skills = $true
}

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
}
else {
    Write-Info "Remote mode - downloading from GitHub"
}

# --- Fetch file helper ---
function Get-PolicyFile {
    param([string]$FileName, [string]$Dest)

    if ($LocalMode) {
        Copy-Item "$ScriptDir\$FileName" -Destination $Dest -Force
    }
    else {
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
- Apply OWASP Proactive Controls 2024 (C1-C10) to every new feature

Reference policies/ for detailed YAML security rulesets:
- policies/base_policy.yaml - 11 security domains
- policies/owasp_asvs.yaml - ASVS 5.0.0 (V1-V17)
- policies/cwe_top25.yaml - CWE/SANS Top 25 2025
- policies/llm_security.yaml - OWASP LLM Top 10 2025
- policies/owasp_proactive_controls.yaml - OWASP Proactive Controls 2024 (C1-C10)
"@

# --- Step 1: Copy core files ---
Write-Step "Installing security policies to $TargetDir"

# AGENT_RULES.md (standard or lite based on profile)
if ($RuleProfile -eq "lite") {
    $RulesFile = "AGENT_RULES_LITE.md"
    $RulesDest = "AGENT_RULES_LITE.md"
}
else {
    $RulesFile = "AGENT_RULES.md"
    $RulesDest = "AGENT_RULES.md"
}

if (Test-Path "$TargetDir\$RulesDest") {
    Write-Warn "$RulesDest already exists - skipping (non-destructive)"
}
else {
    Get-PolicyFile $RulesFile "$TargetDir\$RulesDest"
    Write-Ok "$RulesDest (profile: $RuleProfile)"
}

# Also copy full rules if installing lite (for reference)
if ($RuleProfile -eq "lite" -and -not (Test-Path "$TargetDir\AGENT_RULES.md")) {
    Get-PolicyFile "AGENT_RULES.md" "$TargetDir\AGENT_RULES.md"
    Write-Ok "AGENT_RULES.md (full reference)"
}

# policies/
$PoliciesDir = Join-Path $TargetDir "policies"
if (-not (Test-Path $PoliciesDir)) { New-Item -ItemType Directory -Path $PoliciesDir -Force | Out-Null }

$PolicyFiles = @("base_policy.yaml", "owasp_asvs.yaml", "owasp_masvs.yaml", "cwe_top25.yaml", "llm_security.yaml", "owasp_proactive_controls.yaml")
foreach ($policy in $PolicyFiles) {
    $dest = Join-Path $PoliciesDir $policy
    if (Test-Path $dest) {
        Write-Warn "policies/$policy already exists - skipping"
    }
    else {
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
                }
                else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n$InstructionsBlock"
                    Add-Content -Path $copilotFile -Value $appendText
                    Write-Ok ".github/copilot-instructions.md - appended security rules"
                }
            }
            else {
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
                }
                else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n## Security Policy`n`n$InstructionsBlock"
                    Add-Content -Path $codexFile -Value $appendText
                    Write-Ok "AGENTS.md - appended security rules"
                }
            }
            else {
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
                }
                else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n## Security Policy`n`n$InstructionsBlock"
                    Add-Content -Path $claudeFile -Value $appendText
                    Write-Ok "CLAUDE.md - appended security rules"
                }
            }
            else {
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
            }
            else {
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

        # -- OpenCode --
        "opencode" {
            Write-Step "Configuring OpenCode"
            $ocRulesDir = Join-Path $TargetDir ".claude\rules"
            $ocFile = Join-Path $ocRulesDir "security.md"
            if (-not (Test-Path $ocRulesDir)) { New-Item -ItemType Directory -Path $ocRulesDir -Force | Out-Null }

            $ocSkillsDir = Join-Path $TargetDir ".opencode\skills"
            $ocCmdDir = Join-Path $TargetDir ".opencode\command"
            if (-not (Test-Path $ocSkillsDir)) { New-Item -ItemType Directory -Path $ocSkillsDir -Force | Out-Null }
            if (-not (Test-Path $ocCmdDir)) { New-Item -ItemType Directory -Path $ocCmdDir -Force | Out-Null }

            if (Test-Path $ocFile) {
                $content = Get-Content $ocFile -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match "AGENT_RULES\.md") {
                    Write-Warn ".claude/rules/security.md already references AGENT_RULES.md - skipping"
                }
                else {
                    $appendText = "`n`n<!-- agent-security-policies -->`n$InstructionsBlock"
                    Add-Content -Path $ocFile -Value $appendText
                    Write-Ok ".claude/rules/security.md - appended security rules"
                }
            }
            else {
                $ocContent = @"
---
description: Security policy - OWASP ASVS 5.0.0, CWE Top 25 2025, NIST SSDF, OWASP Proactive Controls 2024
alwaysApply: true
---

$InstructionsBlock
"@
                Set-Content -Path $ocFile -Value $ocContent
                Write-Ok ".claude/rules/security.md - created (always-on rule)"
            }

            # Install Aegis agent if -Omo
            if ($Omo) {
                $aegisDir = Join-Path $TargetDir ".claude\agents"
                $aegisFile = Join-Path $aegisDir "aegis.md"
                if (-not (Test-Path $aegisDir)) { New-Item -ItemType Directory -Path $aegisDir -Force | Out-Null }

                if (Test-Path $aegisFile) {
                    Write-Warn ".claude/agents/aegis.md already exists - skipping"
                }
                else {
                    $aegisContent = @"
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

# Aegis - Security Specialist Agent

You are **Aegis**, a security specialist AI agent built on ``agent-security-policies``.

## Your Mission

Systematically find and fix security vulnerabilities in code, infrastructure, and AI agent behavior. Enforce OWASP, CWE/SANS, NIST, and Proactive Controls standards on every task.

## Working Method

1. Read AGENT_RULES.md before any task
2. Use /checkpoint before making changes
3. Select skill(s) for the request
4. Execute following SKILL.md instructions
5. Triage: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
6. Apply fixes with fix-findings skill
7. Re-scan to verify
8. Report with CWE/CVE/OWASP mapping

## Git Safety Rules

Never force push. Never --no-verify. Never ``git add -A`` blindly. Never modify git config. Never commit .env. See Rule 12 in AGENT_RULES.md.
"@
                    Set-Content -Path $aegisFile -Value $aegisContent
                    Write-Ok ".claude/agents/aegis.md - Aegis security agent installed"
                }
            }
        }

        default {
            Write-Warn "Unknown agent: $ag - skipping (supported: copilot, codex, claude, antigravity, opencode)"
        }
    }
}

# --- Step 3: Install skills if requested ---
if ($Skills) {
    Write-Step "Installing security skills"

    # Copy skills/ directory
    $skillsDir = Join-Path $TargetDir "skills"
    if (-not (Test-Path $skillsDir)) { New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null }

    foreach ($skill in $SkillsList) {
        $skillDir = Join-Path $skillsDir $skill
        if (-not (Test-Path $skillDir)) { New-Item -ItemType Directory -Path $skillDir -Force | Out-Null }
        $skillFile = Join-Path $skillDir "SKILL.md"
        if (Test-Path $skillFile) {
            Write-Warn "skills/$skill/SKILL.md already exists - skipping"
        }
        else {
            Get-PolicyFile "skills/$skill/SKILL.md" $skillFile
            Write-Ok "skills/$skill/SKILL.md"
        }
    }

    # Copy commands/ directory
    Write-Step "Installing security commands"
    $commandsDir = Join-Path $TargetDir "commands"
    if (-not (Test-Path $commandsDir)) { New-Item -ItemType Directory -Path $commandsDir -Force | Out-Null }

    foreach ($cmd in $CommandsList) {
        $cmdFile = Join-Path $commandsDir "$cmd.md"
        if (Test-Path $cmdFile) {
            Write-Warn "commands/$cmd.md already exists - skipping"
        }
        else {
            Get-PolicyFile "commands/$cmd.md" $cmdFile
            Write-Ok "commands/$cmd.md"
        }
    }

    # Helper: strip YAML frontmatter
    function Remove-YamlFrontmatter {
        param([string]$Content)
        if ($Content -match '^---') {
            $lines = $Content -split "`n"
            $inFrontmatter = $false
            $pastFrontmatter = $false
            $result = @()
            foreach ($line in $lines) {
                if (-not $pastFrontmatter -and $line -match '^---') {
                    if ($inFrontmatter) {
                        $pastFrontmatter = $true
                        continue
                    }
                    $inFrontmatter = $true
                    continue
                }
                if ($pastFrontmatter -or -not $inFrontmatter) {
                    $result += $line
                }
            }
            return ($result -join "`n").TrimStart()
        }
        return $Content
    }

    # Install skills per agent
    foreach ($ag in $AgentList) {
        switch ($ag) {

            # Antigravity - native SKILL.md format
            "antigravity" {
                Write-Step "Installing skills for Antigravity"
                foreach ($skill in $SkillsList) {
                    $agSkillDir = Join-Path $TargetDir ".agent\skills\$skill"
                    if (-not (Test-Path $agSkillDir)) { New-Item -ItemType Directory -Path $agSkillDir -Force | Out-Null }
                    $agSkillFile = Join-Path $agSkillDir "SKILL.md"
                    if (Test-Path $agSkillFile) {
                        Write-Warn ".agent/skills/$skill/SKILL.md already exists - skipping"
                    }
                    else {
                        Copy-Item (Join-Path $skillsDir "$skill\SKILL.md") -Destination $agSkillFile
                        Write-Ok ".agent/skills/$skill/SKILL.md"
                    }
                }
            }

            # Claude CLI - slash commands
            "claude" {
                Write-Step "Installing skills for Claude CLI"
                $claudeCmdsDir = Join-Path $TargetDir ".claude\commands"
                if (-not (Test-Path $claudeCmdsDir)) { New-Item -ItemType Directory -Path $claudeCmdsDir -Force | Out-Null }
                foreach ($skill in $SkillsList) {
                    $cmdFile = Join-Path $claudeCmdsDir "$skill.md"
                    if (Test-Path $cmdFile) {
                        Write-Warn ".claude/commands/$skill.md already exists - skipping"
                    }
                    else {
                        $raw = Get-Content (Join-Path $skillsDir "$skill\SKILL.md") -Raw
                        $stripped = Remove-YamlFrontmatter $raw
                        Set-Content -Path $cmdFile -Value $stripped
                        Write-Ok ".claude/commands/$skill.md"
                    }
                }
                # Also install user-invocable commands for Claude
                foreach ($cmd in $CommandsList) {
                    $cmdFile = Join-Path $claudeCmdsDir "$cmd.md"
                    if (Test-Path $cmdFile) {
                        Write-Warn ".claude/commands/$cmd.md already exists - skipping"
                    }
                    else {
                        $raw = Get-Content (Join-Path $commandsDir "$cmd.md") -Raw
                        $stripped = Remove-YamlFrontmatter $raw
                        Set-Content -Path $cmdFile -Value $stripped
                        Write-Ok ".claude/commands/$cmd.md"
                    }
                }
            }

            # Copilot - prompt files
            "copilot" {
                Write-Step "Installing skills for Copilot"
                $promptsDir = Join-Path $TargetDir ".github\prompts"
                if (-not (Test-Path $promptsDir)) { New-Item -ItemType Directory -Path $promptsDir -Force | Out-Null }
                foreach ($skill in $SkillsList) {
                    $promptFile = Join-Path $promptsDir "$skill.prompt.md"
                    if (Test-Path $promptFile) {
                        Write-Warn ".github/prompts/$skill.prompt.md already exists - skipping"
                    }
                    else {
                        $raw = Get-Content (Join-Path $skillsDir "$skill\SKILL.md") -Raw
                        $stripped = Remove-YamlFrontmatter $raw
                        Set-Content -Path $promptFile -Value $stripped
                        Write-Ok ".github/prompts/$skill.prompt.md"
                    }
                }
                # Also install user-invocable commands for Copilot
                foreach ($cmd in $CommandsList) {
                    $promptFile = Join-Path $promptsDir "$cmd.prompt.md"
                    if (Test-Path $promptFile) {
                        Write-Warn ".github/prompts/$cmd.prompt.md already exists - skipping"
                    }
                    else {
                        $raw = Get-Content (Join-Path $commandsDir "$cmd.md") -Raw
                        $stripped = Remove-YamlFrontmatter $raw
                        Set-Content -Path $promptFile -Value $stripped
                        Write-Ok ".github/prompts/$cmd.prompt.md"
                    }
                }
            }

            # Codex CLI - append to AGENTS.md
            "codex" {
                Write-Step "Installing skills for Codex CLI"
                $codexFile = Join-Path $TargetDir "AGENTS.md"
                foreach ($skill in $SkillsList) {
                    $existingContent = if (Test-Path $codexFile) { Get-Content $codexFile -Raw -ErrorAction SilentlyContinue } else { "" }
                    if ($existingContent -and $existingContent -match "skill:$skill") {
                        Write-Warn "AGENTS.md already contains $skill skill - skipping"
                    }
                    else {
                        $raw = Get-Content (Join-Path $skillsDir "$skill\SKILL.md") -Raw
                        $stripped = Remove-YamlFrontmatter $raw
                        $appendText = "`n`n<!-- skill:$skill -->`n$stripped"
                        Add-Content -Path $codexFile -Value $appendText
                        Write-Ok "AGENTS.md - appended $skill skill"
                    }
                }
            }

            # OpenCode - native SKILL.md in .opencode/skills + commands in .opencode/command
            "opencode" {
                Write-Step "Installing skills for OpenCode"
                foreach ($skill in $SkillsList) {
                    $ocSkillDir = Join-Path $TargetDir ".opencode\skills\$skill"
                    if (-not (Test-Path $ocSkillDir)) { New-Item -ItemType Directory -Path $ocSkillDir -Force | Out-Null }
                    $ocSkillFile = Join-Path $ocSkillDir "SKILL.md"
                    if (Test-Path $ocSkillFile) {
                        Write-Warn ".opencode/skills/$skill/SKILL.md already exists - skipping"
                    }
                    else {
                        Copy-Item (Join-Path $skillsDir "$skill\SKILL.md") -Destination $ocSkillFile
                        Write-Ok ".opencode/skills/$skill/SKILL.md"
                    }
                }
                Write-Step "Installing commands for OpenCode"
                foreach ($cmd in $CommandsList) {
                    $ocCmdFile = Join-Path $TargetDir ".opencode\command\$cmd.md"
                    if (Test-Path $ocCmdFile) {
                        Write-Warn ".opencode/command/$cmd.md already exists - skipping"
                    }
                    else {
                        Copy-Item (Join-Path $commandsDir "$cmd.md") -Destination $ocCmdFile
                        Write-Ok ".opencode/command/$cmd.md"
                    }
                }
            }
        }
    }
}

# --- Step 4: .gitignore ---
if ($Gitignore) {
    Write-Step "Adding installed files to .gitignore"

    $MarkerStart = "# >>> agent-security-policies >>>"
    $MarkerEnd   = "# <<< agent-security-policies <<<"
    $GitignoreFile = Join-Path $TargetDir ".gitignore"

    $entries = @("AGENT_RULES.md")
    if ($RuleProfile -eq "lite") { $entries += "AGENT_RULES_LITE.md" }
    $entries += "policies/"

    foreach ($ag in $AgentList) {
        switch ($ag) {
            "copilot"     { $entries += ".github/copilot-instructions.md" }
            "codex"       { $entries += "AGENTS.md" }
            "claude"      { $entries += "CLAUDE.md" }
            "antigravity" { $entries += ".agent/rules/security.md" }
            "opencode"    { $entries += ".claude/rules/security.md"; $entries += ".claude/agents/" }
        }
    }

    if ($Skills) {
        $entries += "skills/"
        $entries += "commands/"
        foreach ($ag in $AgentList) {
            switch ($ag) {
                "antigravity" { $entries += ".agent/skills/" }
                "claude"      { $entries += ".claude/commands/" }
                "copilot"     { $entries += ".github/prompts/" }
                "opencode"    { $entries += ".opencode/skills/"; $entries += ".opencode/command/" }
            }
        }
    }

    $block = ($MarkerStart, ($entries -join "`n"), $MarkerEnd) -join "`n"

    if (Test-Path $GitignoreFile) {
        $existing = Get-Content $GitignoreFile -Raw -ErrorAction SilentlyContinue
        if ($existing -and $existing -match [regex]::Escape($MarkerStart)) {
            $startIdx = $existing.IndexOf($MarkerStart)
            $endIdx   = $existing.IndexOf($MarkerEnd)
            if ($startIdx -ge 0 -and $endIdx -ge 0) {
                $newContent = $existing.Substring(0, $startIdx) + $block + $existing.Substring($endIdx + $MarkerEnd.Length)
                Set-Content -Path $GitignoreFile -Value $newContent -NoNewline
                Write-Ok ".gitignore - updated existing block"
            }
        }
        else {
            Add-Content -Path $GitignoreFile -Value "`n$block"
            Write-Ok ".gitignore - appended entries"
        }
    }
    else {
        Set-Content -Path $GitignoreFile -Value $block
        Write-Ok ".gitignore - created"
    }
}

# --- Summary ---
Write-Step "Done!"
Write-Host ""
Write-Info "Files installed in: $TargetDir"
Write-Info "Agents configured: $Agent"
Write-Info "Profile: $RuleProfile"
if ($Skills) {
    Write-Info "Skills installed: $($SkillsList -join ', ')"
    Write-Info "Commands installed: $($CommandsList -join ', ')"
}
if ($Omo) { Write-Info "Aegis security agent installed (.claude/agents/aegis.md)" }
if ($Gitignore) { Write-Info "Installed files added to .gitignore" }
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
if ($Gitignore) {
    Write-Host "    1. Commit the updated .gitignore to your repository"
} else {
    Write-Host "    1. Commit the new files to your repository"
}
Write-Host "    2. Your AI agent will automatically detect the security rules"
Write-Host "    3. Read AGENT_RULES.md for the full security ruleset"
if ($Skills) { Write-Host "    4. Try a skill: ask your agent to run sast-scan or threat-model" }
if ($Omo)    { Write-Host "    5. Delegate security tasks to Aegis: ask your agent to invoke Aegis" }
Write-Host ""
Write-Host "  Docs: " -NoNewline
Write-Host "https://github.com/raomaster/agent-security-policies" -ForegroundColor Blue
