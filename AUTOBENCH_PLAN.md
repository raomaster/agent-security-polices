# AutoBench — Plan de Implementación

## Concepto

Inspirado en autoresearch de Karpathy, pero en vez de entrenar un modelo ML, **mejora iterativamente las skills de seguridad del proyecto**.

```
┌──────────────────────────────────────────────────────────┐
│                   AUTO-LEARNING LOOP                     │
│                                                          │
│  benchmarks/ ──▶ scan ──▶ evaluate ──▶ identify gaps     │
│       ▲                                      │           │
│       │                                      ▼           │
│       └──── commit ◀── improve ◀── analyze patterns      │
│              (si mejora)    (skill instructions, CWE     │
│       │                              mappings, rules)    │
│       │                                      │           │
│       └──── revert ◀── discard ◀── (si no mejora)       │
│                                                          │
│  Metrica: val_score (precision + recall + F1 combinado)  │
│  Budget: ~100 iteraciones overnight                      │
└──────────────────────────────────────────────────────────┘
```

## Qué se Mejora Iterativamente

| Target | Qué se modifica | Ejemplo |
|--------|----------------|---------|
| `skills/*/SKILL.md` | Instrucciones, false-positive exclusions, CWE mappings | Agregar "Skip findings in test/ directories" |
| `policies/*.yaml` | Reglas CWE, controles, severidad | Ajustar severity de CWE-330 |
| `AGENT_RULES.md` | Reglas de seguridad | Agregar nueva regla para patrón descubierto |
| Semgrep configs | Reglas custom, exclusiones | Agregar `.semgrepignore` patterns |

## Estructura de Archivos

```
agent-security-policies/
├── autobench/                        # NO en npm publish, SÍ en git
│   ├── package.json                  # Dev deps: tsx, vitest, chart.js types
│   ├── tsconfig.json
│   ├── run.ts                        # Entry: npx tsx autobench/run.ts
│   ├── types.ts                      # Interfaces
│   ├── scanner.ts                    # Ejecuta semgrep/gitleaks/trivy/kics
│   ├── evaluator.ts                  # TP/FP/FN → métricas
│   ├── fixer.ts                      # LLM agent para sugerir mejoras
│   ├── runner.ts                     # Loop autónomo (como autoresearch)
│   ├── dashboard.ts                  # Genera HTML con Chart.js
│   ├── results.ts                    # TSV logging
│   ├── program.md                    # Instrucciones para el agente autónomo
│   └── __tests__/
│       ├── evaluator.test.ts
│       ├── scanner.test.ts
│       └── runner.test.ts
│
├── benchmarks/                       # Código vulnerable + ground truth
│   ├── manifest.json                 # Índice: {cases: [...]}
│   ├── CWE-079-XSS/
│   │   ├── ground.json               # Ground truth por caso
│   │   ├── reflected-xss.js          # Vulnerable
│   │   ├── stored-xss.ts             # Vulnerable
│   │   ├── safe-render.js            # FALSE POSITIVE sample
│   │   └── xss-jinja.py              # Vulnerable (Python)
│   ├── CWE-089-SQLi/
│   │   ├── ground.json
│   │   ├── concat-sqli.js
│   │   ├── format-sqli.py
│   │   └── safe-parameterized.js     # FALSE POSITIVE sample
│   ├── CWE-078-CmdInjection/
│   ├── CWE-798-HardcodedSecrets/
│   ├── CWE-532-LogSecrets/
│   ├── CWE-327-WeakCrypto/
│   ├── CWE-330-WeakRandom/
│   ├── CWE-022-PathTraversal/
│   ├── CWE-073-ExtControlPath/
│   ├── CWE-502-Deserialization/
│   ├── CWE-915-MassAssignment/
│   ├── CWE-287-AuthBypass/
│   ├── CWE-862-MissingAuthz/
│   ├── IaC-Terraform/
│   └── IaC-Kubernetes/
│
├── results/                          # Output (gitignored except dashboard template)
│   ├── results.tsv                   # Métricas por iteración
│   └── dashboard/
│       └── index.html                # Generado
│
└── (resto sin cambios)
```

## Formatos Clave

### `benchmarks/CWE-079-XSS/ground.json`
```json
{
  "cwe": "CWE-079",
  "name": "Cross-Site Scripting",
  "category": "Injection",
  "cases": [
    {
      "id": "xss-001",
      "file": "reflected-xss.js",
      "language": "javascript",
      "vulnerable": true,
      "findings": [
        {
          "line": 8,
          "cwe": "CWE-079",
          "severity": "HIGH",
          "description": "innerHTML with unsanitized user input"
        }
      ]
    },
    {
      "id": "xss-004",
      "file": "safe-render.js",
      "language": "javascript",
      "vulnerable": false,
      "findings": [],
      "note": "Uses DOMPurify — must NOT trigger"
    }
  ]
}
```

### `results.tsv`
```
run_id	timestamp	cwe	tool	case_id	tp	fp	fn	precision	recall	f1	status	improvement	description
1	2026-03-26T10:00:00Z	CWE-079	semgrep	xss-001	1	0	0	1.000	1.000	1.000	baseline	—	initial run
1	2026-03-26T10:00:01Z	CWE-079	semgrep	xss-004	0	1	0	0.000	0.000	0.000	baseline	—	FP: DOMPurify flagged
2	2026-03-26T10:05:00Z	CWE-079	semgrep	xss-004	0	0	0	1.000	1.000	1.000	keep	+0.05	added semgrepignore for safe patterns
```

### `types.ts` — Interfaces Principales
```typescript
interface BenchmarkCase {
  id: string;
  file: string;
  language: string;
  cwe: string;
  vulnerable: boolean;
  findings: GroundTruthFinding[];
  note?: string;
}

interface GroundTruthFinding {
  line: number;
  cwe: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

interface ScanFinding {
  tool: string;
  file: string;
  line: number;
  cwe: string;
  severity: string;
  message: string;
  ruleId: string;
}

interface Metrics {
  cwe: string;
  tool: string;
  caseId: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  durationMs: number;
}

interface RunResult {
  runId: number;
  timestamp: string;
  aggregatePrecision: number;
  aggregateRecall: number;
  aggregateF1: number;
  totalCases: number;
  metrics: Metrics[];
}
```

## Flujo del Loop Autónomo (`runner.ts`)

Sigue exactamente el patrón de autoresearch:

```
SETUP:
  1. Leer benchmarks/manifest.json
  2. Crear branch: git checkout -b autobench/run-{date}
  3. Inicializar results.tsv con header
  4. Confirmar setup

LOOP (N iteraciones):
  1. Leer estado git (branch/commit actual)
  
  2. Si no es primera iteración:
     a. Analizar métricas previas (dónde hay FP? FN?)
     b. El LLM propone un cambio al SKILL.md o policy:
        - "Agregar exclusion para test/ files en sast-scan"
        - "Mapear Semgrep rule X a CWE-079 en fix-findings"
        - "Ajustar severity de CWE-330 de MEDIUM a HIGH"
     c. Aplicar cambio al archivo objetivo
  
  3. git commit
  
  4. Ejecutar benchmarks:
     a. Para cada caso en benchmarks/:
        - Ejecutar skill (semgrep/gitleaks/etc) sobre el caso
        - Parsear findings
        - Comparar vs ground truth → TP/FP/FN
        - Calcular precision/recall/F1
     
  5. Calcular métricas agregadas
  
  6. Si score mejoró (F1 subió):
     - status = "keep"
     - Mantener commit (avanzar branch)
  Si score empeoró o igual:
     - status = "discard"
     - git reset --hard al commit anterior
  
  7. Loggear a results.tsv
  
  8. Repetir

FINAL:
  - Generar dashboard HTML con evolución
  - Resumen de mejoras encontradas
```

## Dashboard HTML

Genera `results/dashboard/index.html` con:

| Chart | Tipo | Qué muestra |
|-------|------|-------------|
| Score Timeline | Line chart | F1 score por iteración (como progress.png de autoresearch) |
| Precision/Recall por CWE | Grouped bar | P y R para cada CWE category |
| FP Rate por Tool | Horizontal bar | % de falsos positivos por tool |
| Fix Success | Doughnut | % de cambios que mejoraron vs empeoraron |
| Heatmap | Table/heatmap | CWE × Tool matrix con F1 scores |

Todo renderizado con Chart.js vía CDN, sin dependencias npm adicionales.

## Comandos

```bash
# Setup (una vez)
cd autobench && npm install

# Ejecución única (medir baseline)
npx tsx run.ts

# Con propuestas de mejora automáticas
OPENAI_API_KEY=sk-... npx tsx run.ts --fix

# Loop autónomo (100 iteraciones, ~8 horas overnight)
OPENAI_API_KEY=sk-... npx tsx run.ts --loop --iterations 100

# Solo un CWE
npx tsx run.ts --cwe CWE-079

# Solo un tool
npx tsx run.ts --tool semgrep

# Generar dashboard de runs previos
npx tsx run.ts --dashboard
```

## `program.md` (Instrucciones del Agente)

Como el `program.md` de autoresearch pero para seguridad:

```markdown
# AutoBench Agent Instructions

You are an autonomous security researcher improving the agent-security-policies project.

## Your Mission
Iterate on the project's security skills to maximize benchmark scores.

## What You Can Modify
- skills/*/SKILL.md — instructions, false-positive exclusions, CWE mappings
- policies/*.yaml — rules, severity levels, CWE references
- AGENT_RULES.md — core security rules
- .semgrepignore — exclusion patterns

## What You CANNOT Modify
- benchmarks/ — ground truth is fixed
- src/ — the CLI code
- package.json — dependencies

## The Loop
1. Run: npx tsx autobench/run.ts
2. Analyze: Where are the false negatives? False positives?
3. Improve: Modify skill instructions or rules
4. Commit your change
5. Re-run and compare
6. If F1 improved → keep. If not → revert.
7. Repeat forever.

## Rules
- NEVER modify benchmark ground truth
- NEVER disable a rule to reduce false positives (fix the rule instead)
- Each improvement should be a single, focused change
- Log your reasoning in the commit message
```

## `.gitignore` Adiciones

```gitignore
# AutoBench
autobench/node_modules/
results/results.tsv
results/dashboard/
!results/dashboard/.gitkeep
```

## Archivos a Crear (Orden de Implementación)

| # | Archivo | Descripción | Tiempo est. |
|---|---------|-------------|-------------|
| 1 | `autobench/package.json` | Deps: tsx, vitest, @types/node | 5 min |
| 2 | `autobench/tsconfig.json` | Config TS | 5 min |
| 3 | `autobench/types.ts` | Interfaces TypeScript | 15 min |
| 4 | `benchmarks/manifest.json` | Índice de casos | 10 min |
| 5 | `benchmarks/CWE-079-XSS/*` | 5 casos XSS + ground truth | 30 min |
| 6 | `benchmarks/CWE-089-SQLi/*` | 4 casos SQLi + ground truth | 20 min |
| 7 | `benchmarks/CWE-798-*/` | 4 casos secrets | 20 min |
| 8 | `benchmarks/CWE-022-*/` | 3 casos path traversal | 15 min |
| 9 | `benchmarks/IaC-*/*` | 5 casos Terraform/K8s | 25 min |
| 10 | Resto de CWEs | ~25 casos restantes | 60 min |
| 11 | `autobench/scanner.ts` | Ejecutar tools, parsear output | 45 min |
| 12 | `autobench/evaluator.ts` | Calcular métricas | 30 min |
| 13 | `autobench/results.ts` | TSV logging | 15 min |
| 14 | `autobench/__tests__/evaluator.test.ts` | Tests del evaluador | 20 min |
| 15 | `autobench/fixer.ts` | LLM agent (OpenAI/Anthropic) | 40 min |
| 16 | `autobench/runner.ts` | Loop autónomo | 45 min |
| 17 | `autobench/dashboard.ts` | Generar HTML | 40 min |
| 18 | `autobench/run.ts` | CLI entry point | 20 min |
| 19 | `autobench/program.md` | Instrucciones agente | 15 min |
| 20 | `.gitignore` updates | Ignorar outputs | 2 min |
| | | **Total estimado** | **~7 horas** |

## Verificación

```bash
# Tests del autobench
cd autobench && npx vitest run

# Ejecución de prueba (1 caso)
npx tsx run.ts --cwe CWE-079 --limit 1

# Verificar que el CLI principal NO se rompió
cd .. && npm run test

# Verificar que no se publica
npm pack --dry-run  # autobench/ NO debe aparecer
```
