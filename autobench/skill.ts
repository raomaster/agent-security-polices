import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Skill Definition (parsed from SKILL.md) ───────────────────────

export interface SkillMapping {
  pattern: string;
  cwe: string;
  rule: string;
  regex: RegExp;
}

export interface SkillDef {
  name: string;
  tool: 'semgrep' | 'gitleaks' | 'trivy' | 'kics';
  mappings: SkillMapping[];
  severityMap: Record<string, string>;
  source: string;
}

// ─── Parse SKILL.md ─────────────────────────────────────────────────

export function parseSkillMd(skillName: string): SkillDef {
  const skillPath = resolve(import.meta.dirname, '..', 'skills', skillName, 'SKILL.md');
  let content: string;
  try {
    content = readFileSync(skillPath, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`Skill file not found: ${skillPath}\nAvailable skills are directories under skills/`);
    }
    throw err;
  }

  return {
    name: skillName,
    tool: detectTool(content),
    mappings: parseMappingTable(content),
    severityMap: parseSeverityTable(content),
    source: skillPath
  };
}

function detectTool(content: string): SkillDef['tool'] {
  if (content.includes('semgrep')) return 'semgrep';
  if (content.includes('gitleaks')) return 'gitleaks';
  if (content.includes('trivy')) return 'trivy';
  if (content.includes('kics')) return 'kics';
  return 'semgrep';
}

function parseMappingTable(content: string): SkillMapping[] {
  const mappings: SkillMapping[] = [];
  // Match table rows like: | `*.xss.*` | CWE-79 | Rule 2: Injection Prevention |
  const rowRegex = /\|\s*`([^`]+)`\s*\|\s*(CWE-\d+)\s*\|\s*(Rule\s+\d+.+?)\s*\|/g;
  let match;
  while ((match = rowRegex.exec(content)) !== null) {
    const pattern = match[1];
    const rawCwe = match[2];
    const num = rawCwe.match(/(\d+)/);
    const cwe = num ? `CWE-${num[1].padStart(3, '0')}` : rawCwe;
    mappings.push({
      pattern,
      cwe,
      rule: match[3].trim(),
      regex: globToRegex(pattern)
    });
  }
  return mappings;
}

function parseSeverityTable(content: string): Record<string, string> {
  const map: Record<string, string> = {
    ERROR: 'HIGH',
    WARNING: 'MEDIUM',
    INFO: 'LOW'
  };
  // Override with values from SKILL.md if present
  const sevRegex = /\|\s*`?(\w+)`?\s*\|\s*(?:🔴|🟠|🟡|🔵)?\s*(\w+)\s*(?:\/\s*(\w+))?\s*\|/g;
  let match;
  while ((match = sevRegex.exec(content)) !== null) {
    const from = match[1];
    const to = match[2];
    if (['ERROR', 'WARNING', 'INFO'].includes(from)) {
      map[from] = to;
    }
  }
  return map;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}
