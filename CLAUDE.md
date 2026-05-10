# agent-security-policies — Project Instructions

## Qué es este proyecto

CLI npm (`npx agent-security-policies`) que instala políticas de seguridad portables en cualquier agente de IA (Claude, Copilot, Codex, OpenCode, Antigravity). Instala AGENT_RULES.md, policies/*.yaml y skills/ en el proyecto o globalmente.

## Arquitectura

```
src/
  cli.ts          — entry point, parseArgs, main
  installer.ts    — lógica de instalación (local y global)
  agents.ts       — definiciones de AgentConfig, SkillFormat, PROFILES, SKILLS_LIST
  prompts.ts      — modo interactivo (readline)
  logger.ts       — utilidades de output (info, ok, warn, err, step)

skills/<id>/SKILL.md   — cada skill es un archivo Markdown con frontmatter
policies/*.yaml        — rulesets YAML estructurados (ASVS, CWE, LLM, MASVS, etc.)
AGENT_RULES.md         — reglas completas para el agente (~3200 tokens)
AGENT_RULES_LITE.md    — reglas comprimidas Caveman-style (~1354 tokens, 100% contenido)
benchmarks/            — casos de prueba para AutoBench
autobench/             — motor de benchmark y self-improving loop
```

## Perfiles

- `standard` → instala `AGENT_RULES.md`
- `lite` → instala `AGENT_RULES_LITE.md` + `AGENT_RULES.md` como referencia

El Lite usa compresión estilo Caveman: fragmentos, listas pipe-separated, sin secciones for-humans. Budget: <1400 tokens (~5600 chars). Los tests lo validan.

## Skills disponibles

`sast-scan` · `secrets-scan` · `dependency-scan` · `container-scan` · `iac-scan` · `threat-model` · `security-review` · `fix-findings` · `checkpoint` · `rollback`

## Agentes soportados

`claude` · `copilot` · `codex` · `antigravity` · `opencode`

Cada agente define: `configPath`, `skillFormat`, `globalDir`, `globalConfigPath`, `globalSkillFormat`, `globalDirectories`, `detect()`.

## Comandos

```bash
npm test          # vitest — 208 tests
npm run build     # tsc
npx .             # ejecutar CLI local
```

## Convenciones

- TypeScript ESM (`"type": "module"`)
- Tests en `src/__tests__/*.test.ts` con vitest
- Sin comentarios salvo WHY no obvio
- Sin atribuciones de herramienta en commits ni PRs
- Specs y planes van al KB, no al repo

## AutoBench

Motor en `autobench/` que evalúa la calidad del skill `security-review` contra benchmarks en `benchmarks/`. Corre independiente del CLI principal.
