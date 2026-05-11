import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { ScanFinding } from './types.js';
import type { SkillDef } from './skill.js';

// ─── Execute tool following skill instructions ──────────────────────

export function executeTool(
  skill: SkillDef,
  caseDir: string,
  file: string
): ScanFinding[] {
  const filePath = resolve(caseDir, file);
  if (!existsSync(filePath)) return [];

  switch (skill.tool) {
    case 'semgrep':
      return runSemgrep(caseDir, file, filePath);
    case 'gitleaks':
      return runGitleaks(caseDir, file, filePath);
    default:
      console.warn(`  ⚠ Adapter "${skill.tool}" is not yet implemented. Returning no findings.`);
      return [];
  }
}

// ─── Semgrep (following sast-scan SKILL.md instructions) ────────────

function runSemgrep(caseDir: string, file: string, filePath: string): ScanFinding[] {
  const useDocker = canUseDocker();
  const cmd = useDocker ? 'docker' : 'semgrep';
  const args = useDocker
    ? ['run', '--rm', '-v', `${caseDir}:/src`, 'semgrep/semgrep:latest',
       'semgrep', 'scan', '--config=auto', '--json', '--quiet', `/src/${file}`]
    : ['scan', '--config=auto', '--json', '--quiet', filePath];

  try {
    const stdout = execFileSync(cmd, args, {
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    const report = JSON.parse(stdout);
    return (report.results || []).map((r: any) => ({
      tool: 'semgrep' as const,
      file: r.path ? relative(caseDir, r.path) : file,
      line: r.start?.line || 0,
      column: r.start?.col,
      endLine: r.end?.line,
      cwe: extractCwe(r.extra?.metadata?.cwe),
      severity: r.extra?.severity || 'WARNING',
      message: r.extra?.message || '',
      ruleId: r.check_id || '',
      confidence: r.extra?.metadata?.confidence === 'HIGH' ? 90 : 50
    }));
  } catch (err: any) {
    // ENOENT means the tool is not installed — propagate so the caller knows results are unreliable
    if (err.code === 'ENOENT') {
      throw new Error(`semgrep not found. Install it or ensure Docker is available. (${err.message})`);
    }
    // Any other error (parse failure, timeout, exit code) → no findings for this case
    console.warn(`  ⚠ semgrep returned no findings for ${file}: ${err.message?.split('\n')[0] ?? err}`);
    return [];
  }
}

// ─── Gitleaks (following secrets-scan SKILL.md instructions) ────────

function runGitleaks(caseDir: string, file: string, filePath: string): ScanFinding[] {
  const useDocker = canUseDocker();
  // Docker: write report inside /src (already mounted) so the host can read it after --rm
  // Local: write to /tmp to avoid polluting the source directory
  const hostReportPath = useDocker
    ? `${caseDir}/.gitleaks-report.json`
    : `/tmp/gitleaks-${Date.now()}.json`;
  const containerReportPath = '/src/.gitleaks-report.json';

  const cmd = useDocker ? 'docker' : 'gitleaks';
  const args = useDocker
    ? ['run', '--rm', '-v', `${caseDir}:/src`, 'zricethezav/gitleaks:latest',
       'detect', '--source=/src', '--report-format=json', `--report-path=${containerReportPath}`, '--no-git', '--exit-code=0']
    : ['detect', `--source=${caseDir}`, '--report-format=json', `--report-path=${hostReportPath}`, '--no-git', '--exit-code=0'];

  try {
    execFileSync(cmd, args, { timeout: 30_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

    if (existsSync(hostReportPath)) {
      const report = JSON.parse(readFileSync(hostReportPath, 'utf-8'));
      unlinkSync(hostReportPath);
      return report
        .filter((f: any) => f.File === file || f.File?.endsWith('/' + file))
        .map((f: any) => ({
          tool: 'gitleaks' as const,
          file: f.File || file,
          line: f.StartLine || 0,
          cwe: 'CWE-798',
          severity: 'HIGH' as const,
          message: f.Description || f.RuleID || 'Secret detected',
          ruleId: f.RuleID || ''
        }));
    }
    return [];
  } catch (err: any) {
    // ENOENT means the tool is not installed — propagate so the caller knows results are unreliable
    if (err.code === 'ENOENT') {
      throw new Error(`gitleaks not found. Install it or ensure Docker is available. (${err.message})`);
    }
    // Any other error (timeout, exit code, parse failure) → no findings for this case
    console.warn(`  ⚠ gitleaks returned no findings for ${file}: ${err.message?.split('\n')[0] ?? err}`);
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function canUseDocker(): boolean {
  try {
    execFileSync('docker', ['--version'], { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function extractCwe(cweField: any): string {
  if (!cweField) return 'UNKNOWN';
  const arr = Array.isArray(cweField) ? cweField : [cweField];
  const first = String(arr[0]);
  const match = first.match(/CWE-?(\d+)/);
  return match ? `CWE-${match[1].padStart(3, '0')}` : first;
}
