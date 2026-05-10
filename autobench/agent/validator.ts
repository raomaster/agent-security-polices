import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Proposal, TriedChange } from '../types.js';

const ROOT = resolve(import.meta.dirname, '../..');

const ALLOWED_TARGET_PREFIXES = [
  'skills/',
  'policies/',
  'AGENT_RULES.md',
];

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validate a proposal before applying it.
 * Checks are run in order — returns on first failure.
 */
export function validateProposal(
  proposal: Proposal,
  triedChanges: TriedChange[]
): ValidationResult {
  // 1. Target file must be in an allowed prefix
  const allowed = ALLOWED_TARGET_PREFIXES.some(prefix => proposal.file.startsWith(prefix));
  if (!allowed) {
    return {
      valid: false,
      reason: `File "${proposal.file}" is not in an allowed target. Allowed prefixes: ${ALLOWED_TARGET_PREFIXES.join(', ')}`,
    };
  }

  // 2. find and replace must differ
  if (proposal.find === proposal.replace) {
    return { valid: false, reason: '"find" and "replace" are identical — no change would be made.' };
  }

  // 3. File must exist and be readable
  const filePath = resolve(ROOT, proposal.file);
  if (!existsSync(filePath)) {
    return { valid: false, reason: `File not found: ${proposal.file}` };
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    return { valid: false, reason: `Could not read file: ${err.message}` };
  }

  // 4a. find string minimum length — too short risks ambiguous multi-match
  const MIN_FIND_LENGTH = 10;
  if (proposal.find.trim().length < MIN_FIND_LENGTH) {
    return {
      valid: false,
      reason: `"find" string is too short (${proposal.find.trim().length} chars, minimum ${MIN_FIND_LENGTH}). Use a more specific anchor.`,
    };
  }

  // 4b. find string must exist verbatim in file
  if (!content.includes(proposal.find)) {
    return {
      valid: false,
      reason: `"find" string not found verbatim in ${proposal.file}. Ensure the string matches exactly (whitespace, newlines).`,
    };
  }

  // 4c. find string must appear exactly once — multiple matches would cause unintended replacements
  const firstIdx = content.indexOf(proposal.find);
  const lastIdx  = content.lastIndexOf(proposal.find);
  if (firstIdx !== lastIdx) {
    return {
      valid: false,
      reason: `"find" string appears more than once in ${proposal.file}. Use a more specific anchor that is unique in the file.`,
    };
  }

  // 5. Anti-cycling: reject if identical find+replace was already tried
  const alreadyTried = triedChanges.some(
    c => c.find === proposal.find && c.replace === proposal.replace
  );
  if (alreadyTried) {
    return { valid: false, reason: 'This exact find+replace was already tried in a previous iteration.' };
  }

  // 6. Schema validation: if file is a SKILL.md, verify the mapping table regex still parses
  if (proposal.file.endsWith('SKILL.md')) {
    const modified = content.replace(proposal.find, proposal.replace);
    try {
      validateSkillMdContent(content, modified);
    } catch (err: any) {
      return { valid: false, reason: `SKILL.md would be invalid after change: ${err.message}` };
    }
  }

  return { valid: true };
}

/**
 * Validate that a SKILL.md modification doesn't break the mapping table.
 * Uses the same regex as skill.ts::parseMappingTable to check real parseability.
 */
function validateSkillMdContent(original: string, modified: string): void {
  const rowRegex = /\|\s*`([^`]+)`\s*\|\s*(CWE-\d+)\s*\|\s*(Rule\s+\d+.+?)\s*\|/g;

  // Count valid mapping rows before and after
  const beforeCount = (original.match(rowRegex) || []).length;
  // Reset regex state (global flag)
  rowRegex.lastIndex = 0;
  const afterMatches = modified.match(rowRegex) || [];
  const afterCount = afterMatches.length;

  // Modified file must have at least as many valid rows as before (or exactly one less for remove_mapping)
  if (afterCount < beforeCount - 1) {
    throw new Error(`Mapping table lost ${beforeCount - afterCount} rows (before: ${beforeCount}, after: ${afterCount})`);
  }

  // Check all table rows (lines starting with |) have balanced pipes
  const tableRows = modified.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---'));
  for (const row of tableRows) {
    const pipes = (row.match(/\|/g) || []).length;
    if (pipes < 3) throw new Error(`Malformed table row: ${row.slice(0, 80)}`);
  }
}
