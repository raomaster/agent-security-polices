import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DashboardData, RunResult } from './types.js';
import { readHistory } from './results.js';

const DASHBOARD_DIR = resolve(import.meta.dirname, '..', 'results', 'dashboard');
const DASHBOARD_PATH = resolve(DASHBOARD_DIR, 'index.html');

const CWE_NAMES: Record<string, string> = {
  'CWE-079': 'XSS',
  'CWE-089': 'SQL Injection',
  'CWE-078': 'Cmd Injection',
  'CWE-798': 'Hardcoded Secrets',
  'CWE-532': 'Log Secrets',
  'CWE-327': 'Weak Crypto',
  'CWE-330': 'Weak Random',
  'CWE-022': 'Path Traversal',
  'CWE-502': 'Deserialization',
  'CWE-287': 'Auth Bypass',
  'CWE-862': 'Missing Authz',
  'IaC-TF': 'Terraform',
  'IaC-K8S': 'Kubernetes'
};

export function generateDashboard(): void {
  mkdirSync(DASHBOARD_DIR, { recursive: true });

  const history = readHistory();
  const data = buildDashboardData(history);
  const html = renderHTML(data);

  writeFileSync(DASHBOARD_PATH, html, 'utf-8');
  console.log(`\n📊 Dashboard generated: ${DASHBOARD_PATH}`);
}

function buildDashboardData(history: RunResult[]): DashboardData {
  const latest = history.length > 0 ? history[history.length - 1] : null;

  // Build history timeline
  const historyTimeline = history.map(r => ({
    runId: r.runId,
    timestamp: r.timestamp,
    f1: r.aggregate.f1,
    precision: r.aggregate.precision,
    recall: r.aggregate.recall
  }));

  // Build by-CWE breakdown from latest run
  const byCwe: DashboardData['byCwe'] = [];
  if (latest) {
    const cweMap = new Map<string, { tp: number; fp: number; fn: number }>();

    for (const m of latest.metrics) {
      if (!cweMap.has(m.cwe)) cweMap.set(m.cwe, { tp: 0, fp: 0, fn: 0 });
      const c = cweMap.get(m.cwe)!;
      c.tp += m.tp;
      c.fp += m.fp;
      c.fn += m.fn;
    }

    for (const [cwe, stats] of cweMap) {
      const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
      const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
      const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;
      byCwe.push({
        cwe,
        name: CWE_NAMES[cwe] || cwe,
        precision: round(p),
        recall: round(r),
        f1: round(f)
      });
    }
  }

  // Build by-Tool breakdown
  const byTool: DashboardData['byTool'] = [];
  if (latest) {
    const toolMap = new Map<string, { tp: number; fp: number; fn: number }>();

    for (const m of latest.metrics) {
      if (!toolMap.has(m.tool)) toolMap.set(m.tool, { tp: 0, fp: 0, fn: 0 });
      const t = toolMap.get(m.tool)!;
      t.tp += m.tp;
      t.fp += m.fp;
      t.fn += m.fn;
    }

    for (const [tool, stats] of toolMap) {
      const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
      const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
      const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;
      const fpRate = stats.fp + stats.tp > 0 ? stats.fp / (stats.fp + stats.tp) : 0;
      byTool.push({
        tool,
        precision: round(p),
        recall: round(r),
        f1: round(f),
        fpRate: round(fpRate)
      });
    }
  }

  return {
    generated: new Date().toISOString(),
    totalRuns: history.length,
    latestRun: latest,
    history: historyTimeline,
    byCwe,
    byTool
  };
}

function renderHTML(data: DashboardData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoBench Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 2rem; color: #58a6ff; }
    .header p { color: #8b949e; margin-top: 8px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; text-align: center; }
    .card .value { font-size: 2rem; font-weight: bold; color: #58a6ff; }
    .card .label { color: #8b949e; font-size: 0.85rem; margin-top: 4px; }
    .card.good .value { color: #3fb950; }
    .card.warn .value { color: #d29922; }
    .card.bad .value { color: #f85149; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .chart-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
    .chart-box h3 { color: #c9d1d9; margin-bottom: 12px; font-size: 1rem; }
    canvas { max-height: 300px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #30363d; }
    th { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; }
    td { font-size: 0.9rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .badge-good { background: #238636; color: #fff; }
    .badge-warn { background: #9e6a03; color: #fff; }
    .badge-bad { background: #da3633; color: #fff; }
    .footer { text-align: center; color: #484f58; font-size: 0.8rem; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛡️ AutoBench Dashboard</h1>
    <p>Security Skills Benchmarking — Generated ${data.generated}</p>
  </div>

  <div class="cards">
    <div class="card ${data.latestRun ? (data.latestRun.aggregate.f1 >= 0.8 ? 'good' : data.latestRun.aggregate.f1 >= 0.5 ? 'warn' : 'bad') : ''}">
      <div class="value">${data.latestRun ? (data.latestRun.aggregate.f1 * 100).toFixed(1) + '%' : '—'}</div>
      <div class="label">F1 Score</div>
    </div>
    <div class="card">
      <div class="value">${data.latestRun ? (data.latestRun.aggregate.precision * 100).toFixed(1) + '%' : '—'}</div>
      <div class="label">Precision</div>
    </div>
    <div class="card">
      <div class="value">${data.latestRun ? (data.latestRun.aggregate.recall * 100).toFixed(1) + '%' : '—'}</div>
      <div class="label">Recall</div>
    </div>
    <div class="card">
      <div class="value">${data.totalRuns}</div>
      <div class="label">Total Runs</div>
    </div>
    <div class="card">
      <div class="value">${data.latestRun ? data.latestRun.aggregate.totalCases : 0}</div>
      <div class="label">Cases Tested</div>
    </div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <h3>Precision / Recall / F1 by CWE</h3>
      <canvas id="cweChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>False Positive Rate by Tool</h3>
      <canvas id="toolChart"></canvas>
    </div>
  </div>

  ${data.history.length > 1 ? `
  <div class="charts">
    <div class="chart-box" style="grid-column: 1 / -1;">
      <h3>Score Timeline</h3>
      <canvas id="timelineChart"></canvas>
    </div>
  </div>` : ''}

  <div class="chart-box">
    <h3>CWE Details</h3>
    <table>
      <thead>
        <tr><th>CWE</th><th>Name</th><th>Precision</th><th>Recall</th><th>F1</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.byCwe.map(c => `
        <tr>
          <td>${c.cwe}</td>
          <td>${c.name}</td>
          <td>${(c.precision * 100).toFixed(1)}%</td>
          <td>${(c.recall * 100).toFixed(1)}%</td>
          <td>${(c.f1 * 100).toFixed(1)}%</td>
          <td><span class="badge ${c.f1 >= 0.8 ? 'badge-good' : c.f1 >= 0.5 ? 'badge-warn' : 'badge-bad'}">${c.f1 >= 0.8 ? 'PASS' : c.f1 >= 0.5 ? 'WARN' : 'FAIL'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>AutoBench v0.1.0 — agent-security-policies</p>
  </div>

  <script>
    const cweData = ${JSON.stringify(data.byCwe)};
    const toolData = ${JSON.stringify(data.byTool)};
    const historyData = ${JSON.stringify(data.history)};

    // CWE Chart
    new Chart(document.getElementById('cweChart'), {
      type: 'bar',
      data: {
        labels: cweData.map(c => c.name),
        datasets: [
          { label: 'Precision', data: cweData.map(c => c.precision), backgroundColor: '#58a6ff88' },
          { label: 'Recall', data: cweData.map(c => c.recall), backgroundColor: '#3fb95088' },
          { label: 'F1', data: cweData.map(c => c.f1), backgroundColor: '#d2992288' }
        ]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, max: 1, ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }, x: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } } },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
      }
    });

    // Tool Chart
    new Chart(document.getElementById('toolChart'), {
      type: 'bar',
      data: {
        labels: toolData.map(t => t.tool),
        datasets: [
          { label: 'FP Rate', data: toolData.map(t => t.fpRate), backgroundColor: '#f8514988' },
          { label: 'F1', data: toolData.map(t => t.f1), backgroundColor: '#3fb95088' }
        ]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, max: 1, ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } } },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
      }
    });

    ${data.history.length > 1 ? `
    // Timeline Chart
    new Chart(document.getElementById('timelineChart'), {
      type: 'line',
      data: {
        labels: historyData.map(h => 'Run ' + h.runId),
        datasets: [
          { label: 'F1', data: historyData.map(h => h.f1), borderColor: '#58a6ff', tension: 0.3, fill: false },
          { label: 'Precision', data: historyData.map(h => h.precision), borderColor: '#3fb950', tension: 0.3, fill: false },
          { label: 'Recall', data: historyData.map(h => h.recall), borderColor: '#d29922', tension: 0.3, fill: false }
        ]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, max: 1, ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }, x: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } } },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
      }
    });` : ''}
  </script>
</body>
</html>`;
}

function round(n: number, decimals = 3): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
