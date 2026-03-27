# Propuesta Enterprise y Roadmap de Implementacion

## Contexto

`agent-security-policies` no debe quedarse como un repositorio de prompts o reglas OWASP. Su valor real para una organizacion esta en convertirse en una **capa portable de seguridad y gobernanza para agentes de codigo**, util tanto para:

1. **Desarrollo diario**
Cada developer usa una configuracion comun para que Codex, Claude Code y otros agentes generen codigo mas seguro por defecto.

2. **Auditoria automatizada en pipeline**
Un sistema multiagente audita un repo, aplica estas politicas y skills, genera findings priorizados y abre un PR en una nueva rama con:
- fixes automaticos de bajo riesgo
- propuestas de fix humano para los cambios que requieran criterio o aprobacion

Tu posicion como DevSecOps / Application Security Engineer hace este enfoque especialmente valido: no necesitas competir con OpenAI o Anthropic como runtime, sino ofrecer una **capa enterprise, vendor-neutral y auditable** encima de esos runtimes.

En contexto corporativo, esa capa no debe pensarse solo para OpenAI y Anthropic. Tambien debe ser compatible con ecosistemas donde los equipos operan agentes y copilots sobre:

- OpenAI / Codex
- Anthropic / Claude Code
- GitHub Copilot y Copilot coding agent
- OpenCode / PEA Engine
- Microsoft Foundry / Azure Agent Service / Azure MCP
- Google Vertex AI Agent Engine / Gemini Code Assist / Claude on Vertex

---

## Documento base de diagnostico

Esta propuesta no parte desde cero. Su base es el diagnostico en:

- `security_best_practices_report.md`

Ese documento cumple cuatro funciones dentro del upgrade enterprise:

1. valida que el proyecto ya tiene una buena base de distribucion multiagente y politicas reutilizables
2. identifica gaps reales para llegar a nivel corporativo
3. justifica por que el skill `security-best-practices` debe convertirse en una capacidad nativa del proyecto
4. actua como precedente del tipo de reporte que luego el pipeline multiagente deberia poder generar sobre repos de negocio

### Hallazgos del diagnostico que disparan este upgrade

- hardening insuficiente del propio proyecto para una postura enterprise
- falta de reproducibilidad y evidencia fuerte en la cadena de entrega
- ausencia de un skill contextual de auditoria y best practices
- necesidad de separar mejor politica canonica, referencias por stack y reporting reutilizable

En otras palabras:

> `security_best_practices_report.md` es el documento de diagnostico; esta propuesta es el plan de transformacion.

---

## Tesis de Producto

### Que debe ser este proyecto

`agent-security-policies` debe evolucionar a:

> **Enterprise Security Policy Pack for Coding Agents**

Una capa comun que define:

- politicas de secure-by-default
- reglas de aprobacion y permisos
- skills de revision y remediation
- formatos de evidencia y reporting
- perfiles de uso para developers, CI y auditoria

### Que no debe ser

- otro scanner
- otro agente
- otro framework de prompts genericos

El valor no esta en ejecutar herramientas, sino en **estandarizar como los agentes deben comportarse, revisar, corregir y evidenciar seguridad**.

---

## Problema que resuelve

Hoy una organizacion con varios agentes de codigo tiene estos problemas:

- cada developer usa prompts distintos
- cada vendor tiene su propio modelo de permisos y configuracion
- cada vendor tiene distinta cobertura de remediation y PR suggestions
- los resultados de seguridad no son consistentes
- los PR de remediacion no tienen un formato comun
- los findings no se mapean bien a controles corporativos
- no hay evidencia portable entre Codex, Claude Code y otros agentes
- el mismo control corporativo debe funcionar aunque el runtime real viva en OpenAI, GitHub, OpenCode, Azure o Vertex

Este proyecto puede resolver eso con una capa comun de politica y gobierno.

---

## Por que el valor enterprise no puede depender del vendor

Las capacidades nativas de remediation y PR suggestions de los vendors son utiles, pero no uniformes.

Ejemplo concreto:

- GitHub Copilot Autofix funciona sobre **CodeQL** y, segun la documentacion oficial, soporta generacion de fixes para **un subconjunto de queries** de las suites default y security-extended; no cubre todos los tipos de alertas, no garantiza fix para todos los casos y puede no generar sugerencias por complejidad, contexto o cobertura de lenguaje.

Implicancia:

- una organizacion no puede construir su estrategia de remediation automatizada solo sobre una feature nativa de un vendor
- la cobertura cambia segun scanner, lenguaje, query, contexto del repo y licencia/plataforma
- la forma del output tambien cambia: comentario en PR, sugerencia, fix propuesto, alerta puntual, etc.

Por eso este proyecto debe posicionarse como:

> **capa de normalizacion de seguridad y remediation entre vendors**

El valor corporativo no es reemplazar capacidades del vendor, sino:

- estandarizar criterios de uso
- completar huecos de cobertura
- hacer portable la politica
- producir evidencia comun
- decidir cuando auto-fix, cuando sugerir y cuando escalar a humano

OpenCode hace este punto aun mas visible: en muchos entornos enterprise se adopta precisamente porque permite operar con configuracion por proyecto, permisos controlables y ejecucion acoplada a GitHub Actions o infraestructura propia. Si esta propuesta no lo contempla, la capa "vendor-neutral" queda incompleta.

Esto es aun mas importante cuando una misma organizacion mezcla:

- agentes locales de desarrollo
- agentes de remediation en GitHub
- agentes CLI/open-source como OpenCode con configuracion por proyecto
- agentes empresariales conectados a Azure
- agentes desplegados en Vertex con controles de red, cifrado y observabilidad propios

---

## Casos de Uso Prioritarios

## 1. Baseline corporativo para developers

### Objetivo

Lograr que cualquier developer de la organizacion use una configuracion comun que empuje a los agentes a:

- generar codigo mas seguro
- evitar patrones inseguros comunes
- producir mejor trazabilidad y mejores decisiones
- reducir retrabajo de AppSec en PRs

### Resultado esperado

En cada repo:

- `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` o equivalente
- `policies/` comunes a la organizacion
- perfiles por criticidad
- skills disponibles para revision local o semiautomatica

## 2. Auditoria multiagente en pipeline con PR de fixes

### Objetivo

Al detectar riesgos en un repo, el pipeline debe:

1. clasificar stack y superficie de riesgo
2. ejecutar skills de analisis
3. priorizar findings
4. separar:
   - fixes automaticos y seguros
   - fixes humanos o de mayor impacto
5. crear una nueva rama
6. abrir un PR con:
   - cambios de codigo aplicados
   - resumen ejecutivo
   - rationale de seguridad
   - backlog de fixes manuales

### Resultado esperado

El equipo de desarrollo recibe un PR revisable, no solo un reporte.

---

## Propuesta de Valor Enterprise

La propuesta debe ser concreta:

### A. Estandarizacion

Una sola politica reusable para Codex, Claude Code y otros agentes.

Tambien reusable frente a capacidades nativas no equivalentes entre vendors.

### B. Seguridad operable

No solo reglas; tambien workflows de auditoria, remediation y evidencia.

### C. Auditabilidad

Cada ejecucion deja trazabilidad:

- hallazgos
- fixes propuestos
- fixes aplicados
- cambios que requieren humano
- mapeo a ASVS / CWE / NIST / SSDF

### C2. Normalizacion multi-vendor

El mismo finding debe poder terminar en:

- sugerencia local para developer
- comentario estructurado
- fix automatico
- PR en branch nueva
- backlog de remediacion humana

sin depender de como lo implemente cada vendor.

### D. Adopcion rapida

Se puede desplegar primero como contenido y convenciones, sin esperar integraciones profundas con vendors.

### E. Valor para AppSec

Reduce el esfuerzo manual de:

- secure code review
- triage de findings
- seguimiento de remediacion
- educacion de developers

---

## Que significa realmente "nivel corporativo mas alto"

Para este proyecto, llegar a nivel corporativo alto no significa solo “tener mas reglas” o “soportar mas vendors”. Significa poder pasar una evaluacion seria de plataforma interna, AppSec y gobernanza.

### Capacidades minimas que una organizacion grande va a esperar

1. **Gobernanza**
- perfiles claros por contexto
- politica de aprobaciones
- separacion entre auto-fix y human review
- ownership definido entre AppSec, plataforma y desarrollo

2. **Integridad y supply chain**
- releases verificables
- artefactos pinneados
- CI reproducible
- trazabilidad de cambios y versionado de politicas

3. **Auditabilidad**
- evidencia de cada run
- hallazgos normalizados
- justificacion de fixes
- trazabilidad de excepciones y riesgos remanentes

4. **Portabilidad multi-vendor**
- misma politica sobre OpenAI, Anthropic, GitHub, OpenCode, Azure y Vertex
- independencia respecto a formatos y limites de remediation nativa
- contrato comun de findings, remediation y reporting

5. **Operabilidad corporativa**
- friccion baja para developers
- perfil de costo controlado para CI
- outputs aptos para PR, auditoria y seguimiento
- integracion sencilla con el pipeline multiagente

6. **Cumplimiento y assurance**
- mapping a controles
- evidencia reutilizable para revisiones internas
- politica de excepciones
- narrativa defendible para security architecture review o procurement review

### Implicancia para esta propuesta

La semana 1 no va a completar todo eso, pero si debe dejar creada la base correcta para soportarlo sin rehacer el producto despues.

---

## Gobernanza de tokens y contexto

Esta es una restriccion de producto de primer nivel, no un detalle de implementacion.

Aunque algunos modelos enterprise ofrezcan ventanas de contexto grandes, a nivel corporativo no es razonable operar asumiendo que cada ejecucion puede cargar toda la base de politicas, skills, referencias y evidencia historica. Eso aumenta:

- costo por ejecucion
- latencia
- variabilidad del output
- riesgo de "lost in the middle"
- dependencia excesiva del vendor y del modelo concreto

### Principio rector

> `agent-security-policies` debe diseñarse como un sistema de seleccion y compresion de contexto, no como un paquete de contexto fijo.

### Regla operativa

El repositorio puede contener mucho conocimiento, pero el runtime solo debe cargar:

1. baseline corto del perfil
2. politicas relevantes al contexto
3. skills necesarias para la tarea actual
4. referencias del stack detectado
5. evidencia minima necesaria para decidir o redactar el fix

Nunca debe cargarse por defecto todo lo siguiente junto:

- `AGENT_RULES.md` completo
- todas las policies YAML
- todos los skills
- todas las referencias
- reportes completos previos
- repo completo

### Mecanismos de control obligatorios

1. **Conteo previo de tokens**
- contar o estimar tokens antes de cada llamada relevante
- rechazar, resumir o degradar el modo si excede el presupuesto del perfil

2. **Prefijos estables para caching**
- mantener instrucciones base y bloques estables al inicio
- mover contexto variable al final
- favorecer cache hits en vendors que soporten prompt/context caching

3. **Compresion estructurada**
- resumir findings y politicas en JSON compacto antes de llamar al modelo
- evitar pasar markdown largo cuando basta una estructura

4. **Expansion diferida**
- expandir texto largo solo cuando el agente lo necesite para decidir o escribir el cambio

5. **Fallback por presupuesto**
- si el presupuesto se excede, bajar a un modo mas barato:
  - menos severidades
  - menos archivos
  - menos referencias
  - solo triage

### Implicancia enterprise

El costo debe regularse por politica y por arquitectura, no por disciplina manual del usuario.

Esto tambien encaja bien con runtimes como OpenCode, que ya exponen configuracion por proyecto, permisos por herramienta y mecanismos de compaction de contexto. La propuesta debe apoyarse en esas capacidades cuando existan, sin volverse dependiente de ellas.

---

## Propuesta V1 Enterprise

La V1 no debe intentar resolver todo. Debe enfocarse en valor rapido y usable en 1 semana.

## Alcance V1

### Lo que si entra

1. **Perfiles corporativos**
- `developer-baseline`
- `developer-strict`
- `pipeline`
- `pipeline-audit`
- `pipeline-remediation`

2. **Capa de governance**
- cuando pedir aprobacion humana
- que cambios se pueden automatizar
- que operaciones deben bloquearse
- como normalizar findings y remediaciones entre vendors
- como ensamblar contexto con presupuesto de tokens controlado

3. **Skill de revision contextual**
- nuevo skill `security-best-practices`
- analisis por stack
- reporte priorizado con severidad

4. **Formato estandar de evidencia**
- reporte markdown
- resumen de findings
- template de PR
- lista de remediaciones humanas

5. **Contrato para tu otro proyecto**
- definicion clara de inputs/outputs para el pipeline multiagente

6. **Mecanismo de token governance**
- presupuestos por perfil
- artefactos de contexto compilado
- regla de expansion diferida

### Lo que no entra en esta semana

- integracion nativa con cada vendor enterprise API
- portal web
- UI
- policy engine complejo
- sincronizacion con IAM/SCIM

### Lo que esta semana si debe dejar habilitado para el target corporativo

- una estructura de repo que permita versionar governance, perfiles y evidencia
- un skill contextual que eleve el proyecto desde “pack de politicas” a “motor de auditoria reusable”
- una separacion clara entre baseline para developers y perfiles de pipeline
- un contrato portable que el otro proyecto pueda ejecutar en OpenAI, GitHub, OpenCode, Azure o Vertex
- una narrativa defendible para revisiones internas de AppSec y plataforma

---

## Arquitectura Recomendada

## 1. Capa de contenido

Archivos que viven en este repo:

- `AGENT_RULES.md`
- `policies/*.yaml`
- `skills/*/SKILL.md`

## 2. Capa de governance

Nuevos artefactos recomendados:

- `governance/approval-policy.yaml`
- `governance/change-risk-policy.yaml`
- `governance/pipeline-remediation-policy.yaml`
- `governance/developer-usage-policy.yaml`

Estos archivos deben definir:

- tipos de cambio de bajo, medio y alto riesgo
- operaciones permitidas por contexto
- criterios para auto-fix
- criterios para human review

## 3. Capa de perfiles

Nuevos artefactos recomendados:

- `profiles/developer-baseline.yaml`
- `profiles/developer-strict.yaml`
- `profiles/pipeline.yaml`
- `profiles/pipeline-audit.yaml`
- `profiles/pipeline-remediation.yaml`

Cada perfil decide:

- que policies aplicar
- que skills cargar
- nivel de enforcement
- formato de salida requerido
- presupuesto de tokens y estrategia de compresion

## 4. Capa de reporting

Nuevos templates:

- `templates/security_review_report.md`
- `templates/security_remediation_pr.md`
- `templates/human_fix_plan.md`

## 5. Capa de integracion con el pipeline multiagente

El otro proyecto debe consumir este repo como **policy/content pack**.

Ademas debe tratar las capacidades nativas del vendor como señales opcionales, no como dependencia central.

Contrato recomendado:

### Inputs

- ruta del repo
- perfil a aplicar
- branch base
- modo: `audit` o `remediation`
- stack detectado

### Outputs

- `security_review_report.md`
- `security_findings.json`
- `human_fix_plan.md`
- patch/cambios en branch temporal
- contenido de PR
- metadata de origen del finding y nivel de confianza del fix

### Campo adicional recomendado en findings

Cada finding consolidado deberia incluir:

- `source_vendor`
- `source_tool`
- `finding_type`
- `remediation_mode`
- `autofix_eligibility`
- `human_review_required`

Esto permite usar features nativas del vendor cuando existan, sin acoplar toda la estrategia a ellas.

## 6. Capa de assurance y ciclo de vida

Para que este repositorio sea aceptable a nivel corporativo alto, no basta con contenido tecnico. Tambien debe existir una disciplina de ciclo de vida sobre ese contenido.

Capacidades recomendadas:

- versionado semantico de perfiles y governance
- changelog orientado a impacto de seguridad
- trazabilidad entre findings, policy change y template change
- criterio explicito para deprecacion de reglas
- politica de excepciones documentadas
- evidencia reutilizable para auditoria interna

Artefactos recomendados a futuro:

- `governance/exceptions-policy.yaml`
- `governance/policy-lifecycle.md`
- `templates/policy_exception.md`
- `templates/security_control_mapping.md`

Estos artefactos no son obligatorios para la semana 1, pero si forman parte del target state corporate-grade.

## 7. Capa de ensamblado y compresion de contexto

Esta capa es clave para controlar costo y mantener calidad.

El otro proyecto no debe pasar archivos completos del repo de politicas al modelo. Debe construir contexto runtime compacto a partir de este repositorio.

### Artefactos de compilacion recomendados

- `policy_index.json`
- `stack_policy_selection.json`
- `skill_selection.json`
- `finding_summary.json`
- `repo_risk_snapshot.json`

### Funcion de cada artefacto

#### `policy_index.json`

Indice compacto de:

- `policy_id`
- `rule_id`
- `title`
- `severity`
- `stack_tags`
- `autofix_allowed`
- `human_review_required`

#### `stack_policy_selection.json`

Resultado de seleccionar solo las reglas relevantes para:

- lenguaje
- framework
- tipo de repositorio
- modo (`developer`, `pipeline`, `audit`, `remediation`)

#### `skill_selection.json`

Lista minima de skills a cargar segun stack y objetivo.

#### `finding_summary.json`

Consolidado normalizado de findings, sin narracion larga.

#### `repo_risk_snapshot.json`

Resumen del repo para reuse entre fases:

- stack detectado
- areas sensibles
- tipo de cambios permitidos
- baseline de riesgo

### Regla de implementacion

Los modelos deben consumir preferentemente estos artefactos compactos, y solo expandir texto largo bajo demanda.

---

## Estrategia de ensamblado de prompts

### Orden recomendado

1. `profile header`
2. `governance constraints`
3. `stack-specific policy selection`
4. `task-specific skill instructions`
5. `finding summary`
6. `file excerpts` o diffs minimos necesarios

### Regla de expansion diferida

Solo se debe expandir contenido largo cuando la tarea lo justifique:

- texto completo de una policy
- referencia completa por stack
- bloque grande de codigo
- reporte previo completo

### Regla de budget enforcement

Antes de enviar una llamada:

1. calcular costo/token estimado
2. comparar con el presupuesto del perfil
3. si excede:
- comprimir
- recortar alcance
- cambiar de modo
- o escalar a revision humana

### Regla de preferencia

Preferir siempre:

- IDs
- resumentes estructurados
- excerpts
- JSON compacto

en lugar de:

- markdown largo
- multiples documentos completos
- repo snapshots amplios

---

## Presupuesto de contexto por perfil

Estos presupuestos deben definirse como politicas operativas. No se debe planificar usando el maximo contexto teorico del modelo.

### Regla general

Planificar contra un **presupuesto operativo** conservador, no contra la ventana maxima anunciada por el vendor.

### Presupuesto recomendado para V1

#### `developer-baseline`

- contexto persistente corto
- objetivo: guidance, no auditoria exhaustiva
- cargar baseline + regla/skill puntual bajo demanda

#### `developer-strict`

- un poco mas de governance y restricciones
- evitar referencias largas salvo que haya tarea de review o remediation

#### `pipeline`

- presupuesto mas estricto de todos
- usar solo artefactos compilados y findings resumidos
- no cargar referencias completas salvo excepcion

#### `pipeline-audit`

- mayor presupuesto que `pipeline`
- permitir referencias por stack y algo mas de evidencia
- seguir evitando repo completo y policy corpus completo

#### `pipeline-remediation`

- cargar solo finding priorizado + excerpt de codigo + politica/skill relevante
- no volver a cargar toda la fase de triage

### Recomendacion operativa

En CI corporativo, el perfil `pipeline` debe diseñarse para funcionar bien con presupuestos compactos y predecibles. Si una ejecucion necesita mucho mas contexto, debe escalarse a:

- `pipeline-audit`
- `pipeline-remediation`
- o revision humana

### Decision importante

No debemos diseñar el sistema alrededor de “si el modelo soporta 200k o mas, carguemos todo”. El modelo operativo correcto es:

- usar una fraccion pequeña y estable del contexto total
- medir siempre
- cachear cuando tenga sentido
- expandir solo por excepcion

---

## Modelo operativo corporativo

El valor enterprise del proyecto depende tambien de que el modelo operativo quede claro.

### Roles recomendados

#### AppSec / Product Security

- define baseline de politicas
- aprueba criterios de auto-fix
- prioriza referencias por stack
- revisa excepciones y riesgos remanentes

#### Platform / DevEx

- distribuye perfiles y configuraciones
- integra el proyecto con el pipeline multiagente
- mantiene CI, releases y artefactos verificables
- opera la capa comun entre vendors
- adapta el contenido a runtimes con config por archivos como OpenCode, ademas de CLIs y plataformas administradas

#### Development teams

- usan `developer-baseline` o `developer-strict`
- revisan PRs de remediation
- aceptan o ajustan fixes propuestos
- retroalimentan falsos positivos y gaps por stack

#### Audit / Compliance / Architecture

- consumen evidencia
- revisan mapping a controles
- validan el modelo de excepciones

### Resultado esperado

Este proyecto debe poder servir a los cuatro grupos sin cambiar de identidad de producto. Esa es una condicion importante para llamarlo realmente enterprise.

---

## Flujo objetivo de pipeline

## Modo Audit

1. Detectar stack del repo
2. Cargar perfil `pipeline` o `pipeline-audit` segun el objetivo
3. Ejecutar:
- `sast-scan`
- `secrets-scan`
- `dependency-scan`
- `iac-scan` si aplica
- `container-scan` si aplica
- `security-best-practices`
4. Consolidar findings
5. Priorizar por severidad y remediabilidad
6. Emitir reporte

## Modo Remediation

1. Tomar findings consolidados
2. Aplicar policy de riesgo
3. Auto-fix solo cambios de bajo riesgo
4. Generar plan humano para cambios de mayor impacto
5. Crear branch nueva
6. Commit de fixes
7. Abrir PR con evidencia y recomendaciones

## Reglas de auto-fix recomendadas

### Permitidos en V1

- upgrades de dependencias con `FixedVersion`
- eliminacion de secretos mock o placeholders
- mejoras de configuracion de linters/headers/flags seguras
- cambios de texto/config sin impacto funcional alto
- fixes localizados con patron claramente inseguro y remediacion estandar

### Requieren humano

- cambios de authn/authz
- cambios de flujo de negocio
- cambios en criptografia
- cambios de permisos IAM
- cambios de contratos publicos de API
- cambios que afecten datos o migraciones

### Requieren criterio adicional por limitaciones del vendor

- findings cuya propuesta nativa venga incompleta o parcial
- findings sin contexto suficiente del repo
- findings detectados por un scanner pero no remediados por el vendor
- findings donde el vendor solo sugiera comentario pero no patch aplicable

---

## Entregables concretos para 1 semana

## Entregable 1. Capa enterprise minima en este repo

Agregar:

- `governance/`
- `profiles/`
- `templates/`
- nuevo skill `skills/security-best-practices/`

## Entregable 2. Skill de seguridad contextual

Nuevo skill con workflow:

1. identificar lenguaje y framework
2. cargar referencias relevantes
3. revisar repo y configuracion
4. generar reporte priorizado
5. separar fixes automaticos y humanos

## Entregable 3. Contrato para PR de remediacion

Definir template comun para PR:

- resumen ejecutivo
- findings cubiertos
- files changed
- riesgos remanentes
- fixes manuales sugeridos
- mapping a controles
- origen de cada finding y estrategia de remediation aplicada

## Entregable 4. Perfiles de adopcion

### `developer-baseline`
- secure coding por defecto
- skills opt-in
- baja friccion

### `developer-strict`
- enforcement mas duro
- bloqueos para patrones inseguros
- salida mas estructurada

### `pipeline`
- minima huella de tokens
- foco en determinismo y costo
- salida compacta y estructurada
- solo skills estrictamente necesarios segun stack

### `pipeline-audit`
- foco en deteccion y reporte

### `pipeline-remediation`
- foco en cambios seguros y PR

## Entregable 5. Token governance y prompt assembly

Definir:

- `policy_index.json` shape
- `stack_policy_selection.json` shape
- `skill_selection.json` shape
- `finding_summary.json` shape
- reglas de expansion diferida
- presupuesto de contexto por perfil

## Entregable 6. Hardening minimo del proyecto

Para que sea creible a nivel enterprise:

- lockfile
- CI reproducible
- pinning de imagenes de skills
- eliminar `curl|bash` como camino recomendado principal
- checksums o releases verificables

---

## Roadmap de 1 Semana

## Dia 1. Definicion de producto y estructura

### Objetivo

Cerrar el modelo enterprise y preparar la estructura del repo.

### Tareas

- definir perfiles corporativos
- definir governance minima
- definir contracto de outputs para pipeline
- crear estructura:
  - `governance/`
  - `profiles/`
  - `templates/`

### Entregables

- estructura de carpetas
- primer borrador de policies de governance
- decision document de alcance V1

## Dia 2. Skill `security-best-practices`

### Objetivo

Agregar el skill que hoy falta y que conecta este repo con el caso de uso de auditoria real.

### Tareas

- crear `skills/security-best-practices/SKILL.md`
- definir workflow de review
- definir severidades
- definir formato de reporte
- definir salida para fixes automaticos y humanos

### Entregables

- skill funcional a nivel de instrucciones
- template de reporte asociado

## Dia 3. Referencias por stack

### Objetivo

Hacer que la revision sea contextual y no generica.

### Tareas

- crear `skills/security-best-practices/references/`
- arrancar con stacks de mayor retorno:
  - `javascript-typescript-general-security.md`
  - `javascript-typescript-node-security.md`
  - `python-general-security.md`
  - `java-spring-security.md` o el stack que mas usen internamente
- definir criterio de carga selectiva

### Entregables

- minimo 3-4 referencias de alto valor
- workflow de seleccion por stack

## Dia 4. Governance y perfiles

### Objetivo

Definir como se usa este contenido en developers y pipeline.

### Tareas

- `profiles/developer-baseline.yaml`
- `profiles/developer-strict.yaml`
- `profiles/pipeline.yaml`
- `profiles/pipeline-audit.yaml`
- `profiles/pipeline-remediation.yaml`
- `governance/approval-policy.yaml`
- `governance/change-risk-policy.yaml`

### Entregables

- perfiles utilizables
- politica clara de auto-fix vs human review

## Dia 5. Templates y contrato de PR

### Objetivo

Cerrar el output consumible por developers y por tu otro proyecto.

### Tareas

- `templates/security_review_report.md`
- `templates/security_remediation_pr.md`
- `templates/human_fix_plan.md`
- definir `security_findings.json` schema
- definir normalizacion de findings multi-vendor
- definir artefactos compactos para contexto runtime

### Entregables

- paquete de reporting completo
- contrato listo para integracion

## Dia 6. Token governance y hardening

### Objetivo

Eliminar debilidades visibles del propio proyecto.

### Tareas

- definir estrategia de prompt assembly
- definir presupuestos por perfil
- agregar seccion de token governance al README o docs futuras
- agregar lockfile
- fijar versiones o digests en skills
- CI minima
- ajustar README para posicionamiento enterprise

### Entregables

- estrategia de costo/contexto cerrada
- repo mas confiable
- mensaje consistente con supply chain security

## Dia 7. Integracion inicial con el proyecto multiagente

### Objetivo

Demostrar valor real en pipeline.

### Tareas

- conectar este repo como dependencia de contenido
- probar flujo en un repo ejemplo
- generar branch y PR template de salida
- validar separacion entre fixes automaticos y humanos

### Entregables

- demo funcional end-to-end
- backlog de mejoras post-semana 1

---

## Estructura de Repo Recomendada

```text
.
├── AGENT_RULES.md
├── policies/
├── skills/
│   ├── sast-scan/
│   ├── secrets-scan/
│   ├── dependency-scan/
│   ├── container-scan/
│   ├── iac-scan/
│   ├── threat-model/
│   ├── fix-findings/
│   └── security-best-practices/
│       ├── SKILL.md
│       └── references/
├── governance/
│   ├── approval-policy.yaml
│   ├── change-risk-policy.yaml
│   ├── developer-usage-policy.yaml
│   └── pipeline-remediation-policy.yaml
├── profiles/
│   ├── developer-baseline.yaml
│   ├── developer-strict.yaml
│   ├── pipeline.yaml
│   ├── pipeline-audit.yaml
│   └── pipeline-remediation.yaml
└── templates/
    ├── security_review_report.md
    ├── security_remediation_pr.md
    └── human_fix_plan.md
```

---

## Criterios de Exito

## Exito tecnico

- un developer puede instalar el baseline y obtener mejor calidad de codigo
- el pipeline puede ejecutar audit + remediation con outputs consistentes
- el PR generado es legible y revisable
- la politica separa claramente auto-fix de human review
- el flujo funciona aunque el vendor solo cubra una parte de los findings

## Exito de AppSec

- menos findings repetitivos en PR manuales
- menor tiempo de triage
- mejor trazabilidad de remediacion
- evidencia reusable para auditorias internas

## Exito organizacional

- adopcion inicial por al menos un equipo
- un caso de uso real con PR de remediation
- perfil comun reutilizable por developers y pipeline
- interes o validacion de al menos un stakeholder de plataforma, AppSec o arquitectura

## Exito de nivel corporativo

- la propuesta puede defenderse frente a AppSec, plataforma y procurement tecnico
- el modelo no depende de un solo vendor para remediation o governance
- existe una base clara para policy lifecycle, excepciones y evidencia
- el proyecto puede evolucionar a control plane de contenido sin rediseño estructural

---

## Riesgos y como controlarlos

## Riesgo 1. Querer abarcar demasiado en una semana

### Mitigacion

Separar claramente:

- contenido/politica en este repo
- orquestacion/ejecucion en el otro proyecto

## Riesgo 2. Ambiguedad en los outputs

### Mitigacion

Definir desde el dia 1:

- template de reporte
- template de PR
- schema de findings
- criterios de auto-fix
- estrategia de normalizacion multi-vendor

## Riesgo 3. Costo excesivo por consumo de tokens en pipeline

### Mitigacion

Agregar un perfil `pipeline` especificamente optimizado para costo:

- cargar solo policies y skills relevantes al stack detectado
- preferir salida JSON/Markdown compacta
- evitar duplicar contexto ya presente en reportes previos
- usar severidad minima configurable para reducir hallazgos de bajo valor
- separar una fase barata de triage de una fase mas cara de remediation

## Riesgo 4. Falta de adopcion por developers

### Mitigacion

Mantener `developer-baseline` con baja friccion y `developer-strict` solo para contextos de mayor criticidad.

## Riesgo 5. Falta de credibilidad enterprise

### Mitigacion

Corregir de inmediato debilidades del propio repo:

- lockfile
- pinning
- CI
- artefactos verificables

## Riesgo 6. Quedar tactico y no corporate-grade

### Mitigacion

No presentar el proyecto solo como:

- prompt pack
- paquete de skills
- integracion puntual de pipeline

Sino como:

- capa comun de governance
- contrato multi-vendor
- base de evidencia y assurance
- componente reusable dentro del operating model de AppSec

## Riesgo 7. Drift entre politicas, skills y pipeline

### Mitigacion

Definir desde V1:

- ownership de perfiles
- ownership de governance
- versionado del contrato de findings
- criterio de compatibilidad entre este repo y el otro proyecto

---

## Decision recomendada

La mejor decision para esta semana es:

1. **Reposicionar el proyecto**
No como pack de prompts, sino como capa de seguridad y governance para coding agents.

2. **Construir la V1 alrededor de dos flujos**
- `developer secure coding baseline`
- `pipeline audit + remediation PR`
Y agregar un perfil `pipeline` orientado a costo/token efficiency para uso masivo en CI corporativo.

3. **No depender del autofix nativo de ningun vendor**
Usarlo cuando exista, pero envolverlo en una capa comun de policy, triage y evidencia.

4. **Agregar el skill que falta**
`security-best-practices` debe convertirse en el skill principal para auditoria contextual.

5. **Definir contratos claros**
Perfiles, governance, outputs y templates deben quedar cerrados esta semana.

6. **Usar el otro proyecto como motor**
Ese proyecto ejecuta; este repo define el comportamiento, la politica y la evidencia.

7. **Diseñar para target state corporativo desde el dia 1**
Aunque la semana 1 sea una V1, la estructura debe soportar despues:
- lifecycle de politicas
- excepciones
- assurance
- reporting para stakeholders no tecnicos

---

## Siguiente paso recomendado

Convertir esta propuesta en ejecucion inmediata dentro de este repo, en este orden:

1. crear estructura `governance/`, `profiles/`, `templates/`
2. crear `skills/security-best-practices/`
3. escribir perfiles y templates
4. endurecer el repo
5. integrar con el pipeline multiagente

---

## Anexo: Diseno del perfil `pipeline`

Este perfil debe existir porque el pipeline tiene restricciones distintas al desarrollo interactivo:

- alto volumen de ejecuciones
- presupuesto corporativo de tokens
- necesidad de salidas consistentes
- menor tolerancia a razonamiento largo y narrativo

### Objetivo del perfil

Maximizar:

- señal por token
- remediabilidad
- consistencia de output

Minimizando:

- contexto irrelevante
- hallazgos redundantes
- texto explicativo extenso
- carga de skills no necesarios

### Reglas recomendadas para `pipeline`

1. Cargar solo policies esenciales para el stack detectado
2. Cargar skills por relevancia:
- siempre: `security-best-practices`
- segun stack: `sast-scan`, `dependency-scan`, `secrets-scan`, `iac-scan`, `container-scan`
3. Generar salidas compactas:
- `security_findings.json`
- `security_review_report.md` resumido
- `human_fix_plan.md` solo para findings no automatizables
4. Reducir narracion libre
5. Limitar findings a:
- CRITICAL
- HIGH
- MEDIUM con fix claro o alta remediabilidad
6. Reusar contexto de runs previos si existe baseline del repo
7. Ejecutar remediation detallada solo si el triage inicial justifica el costo

### Estrategia recomendada de 2 fases

#### Fase 1. Triage barato

- deteccion de stack
- carga minima de contexto
- skills relevantes solamente
- salida JSON compacta
- umbral de severidad configurable

#### Fase 2. Remediation selectiva

Se ejecuta solo si:

- hay findings CRITICAL/HIGH
- existe fix automatizable
- el repo esta dentro del alcance permitido

### Diferencia entre perfiles de pipeline

#### `pipeline`
- perfil por defecto para CI corporativo
- optimizado para costo
- salidas compactas
- minima narracion

#### `pipeline-audit`
- mas exhaustivo
- mas contexto
- mejor para assessment o revisiones periodicas

#### `pipeline-remediation`
- activado cuando ya existe finding priorizado
- enfocado en branch, patch y PR

---

## Anexo: Principio de normalizacion multi-vendor

Este proyecto debe asumir que:

- algunos vendors solo cubren ciertos scanners
- algunos vendors solo generan sugerencias, no PRs
- algunos vendors no tienen remediation nativa o la tienen con cobertura parcial
- la calidad y el formato del resultado varian por lenguaje, query y contexto

Por eso el modelo correcto es:

1. **Detectar findings**
Desde scanners, skills o capacidades nativas del vendor

2. **Normalizar findings**
A un formato comun de severidad, tipo, remediabilidad y evidencia

3. **Decidir estrategia**
- auto-fix
- suggested fix
- human-only plan
- no-action

4. **Emitir salida uniforme**
- reporte
- branch
- PR
- backlog manual

En otras palabras:

> el vendor puede aportar remediation; este proyecto debe gobernarla, completarla y hacerla portable

---

## Anexo: Politica de fuentes y evidencia

Este documento debe usar una politica de fuentes explicita para mantenerse util en contexto enterprise.

### Prioridad de fuentes

1. **Fuentes oficiales del vendor**
- documentacion tecnica
- help center
- admin guides
- release notes
- changelogs
- trust/compliance pages

2. **Contexto externo de alto valor**
- papers
- benchmarks
- publicaciones de investigacion
- estudios tecnicos sobre program repair, secure code generation y evaluacion de agentes
- investigaciones sobre autonomia, task horizon y capacidad de completar tareas largas

### Regla de uso

Las fuentes externas solo deben agregarse cuando aporten algo que la documentacion oficial no cubre bien, por ejemplo:

- limites reales de remediation automatizada
- evidencia sobre calidad de patches
- riesgos de secure code generation
- benchmarks utiles para medir capacidad o costo/eficiencia

### Regla editorial

- Toda afirmacion sobre capacidades de vendor debe citar fuente oficial y fecha.
- Toda conclusion estrategica no literal debe marcarse como **Inferencia**.
- Todo contexto externo debe ser seleccionado por utilidad operativa, no por volumen.
- Cuando exista una fuente 2025-2026 debe priorizarse sobre una de 2024; una fuente 2024 solo se mantiene si sigue siendo la referencia canonica o la mejor documentacion disponible para esa capacidad.

---

## Anexo: Fuentes oficiales recomendadas

### OpenAI / Codex

- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Introducing GPT-5.3 Codex](https://openai.com/index/introducing-gpt-5-3-codex/)
- [Codex is now generally available](https://openai.com/index/codex-now-generally-available/)
- [Codex](https://openai.com/codex/)
- [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan/)
- [Enterprise admin getting started guide for Codex](https://help.openai.com/en/articles/11390924-enterprise-admin-getting-started-guide-for-codex)
- [RBAC](https://help.openai.com/en/articles/11750701-rbac/)
- [Codex Security](https://help.openai.com/en/articles/20001107-codex-security)
- [ChatGPT Enterprise & Edu - Release Notes](https://help.openai.com/en/articles/10128477)
- [PaperBench](https://openai.com/research/paperbench/)
- [MLE-bench](https://openai.com/index/mle-bench/)
- [Why SWE-bench Verified no longer measures frontier coding capabilities](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)

### Anthropic / Claude Code

- [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Claude Code security](https://docs.anthropic.com/en/docs/claude-code/security)
- [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Claude Code data usage](https://docs.anthropic.com/en/docs/claude-code/data-usage)
- [Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Token-efficient tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/token-efficient-tool-use)
- [Claude Code release notes](https://docs.anthropic.com/en/release-notes/claude-code)
- [Anthropic API release notes](https://docs.anthropic.com/en/release-notes/api)
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Claude Code development containers](https://docs.anthropic.com/en/docs/claude-code/devcontainer)
- [Claude Code Analytics API](https://docs.anthropic.com/de/api/claude-code-analytics-api)
- [Claude on Vertex AI](https://docs.anthropic.com/en/api/claude-on-vertex-ai)

### GitHub / Copilot / CodeQL

- [Responsible use of Copilot Autofix for code scanning](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/about-autofix-for-codeql-code-scanning)
- [Disabling Copilot Autofix for code scanning security alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/disabling-autofix-for-code-scanning)
- [Resolving code scanning alerts](https://docs.github.com/code-security/code-scanning/managing-code-scanning-alerts/managing-code-scanning-alerts-for-your-repository)
- [Copilot Autofix is available for more code scanning alerts](https://github.blog/changelog/2025-02-20-copilot-autofix-is-available-for-more-code-scanning-alerts/)
- [Enhanced metrics for CodeQL pull request alerts and Copilot autofixes](https://github.blog/changelog/2025-06-04-enhanced-metrics-for-codeql-pull-request-alerts-and-copilot-autofixes)
- [Assign code scanning alerts to Copilot for automated fixes in public preview](https://github.blog/changelog/2025-10-28-assign-code-scanning-alerts-to-copilot-for-automated-fixes-in-public-preview/)
- [Assign issues to Copilot using the API](https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/)
- [Copilot Autofix can now be generated with the REST API](https://github.blog/changelog/2024-12-16-copilot-autofix-can-now-be-generated-with-the-rest-api-public-preview)

### Microsoft / Azure / Foundry

- [What is Foundry Agent Service?](https://learn.microsoft.com/en-us/azure/foundry/agents/overview)
- [Data, privacy, and security for Azure AI Agent Service](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/agents/data-privacy-security)
- [Transparency Note for Azure Agent Service](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/agents/transparency-note)
- [Prompt caching in Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/prompt-caching)
- [Set Up Tracing for AI Agents in Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/observability/how-to/trace-agent-setup)
- [Connect GitHub Copilot coding agent with Azure MCP Server using azd extensions](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/extensions/copilot-coding-agent-extension)
- [What is GitHub Copilot for Azure?](https://learn.microsoft.com/en-us/azure/developer/github-copilot-azure/introduction)

### OpenCode / PEA Engine

- [OpenCode](https://opencode.ai/)
- [Config](https://opencode.ai/docs/config/)
- [Permissions](https://opencode.ai/docs/permissions/)
- [GitHub](https://opencode.ai/docs/github/)
- [Agents](https://opencode.ai/docs/agents/)

### Google Cloud / Vertex / Gemini

- [Vertex AI Agent Engine overview](https://cloud.google.com/agent-builder/agent-engine/overview)
- [Vertex AI Agent Builder release notes](https://cloud.google.com/agent-builder/release-notes)
- [Security controls for Vertex AI](https://cloud.google.com/vertex-ai/docs/general/vertexai-security-controls)
- [Vertex AI shared responsibility](https://cloud.google.com/vertex-ai/docs/shared-responsibility)
- [Count tokens for Claude models on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/count-tokens)
- [Use Agent Engine Threat Detection](https://cloud.google.com/security-command-center/docs/use-agent-engine-threat-detection)
- [Using Private Service Connect interface with Vertex AI Agent Engine](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/private-service-connect-interface)
- [Gemini for Google Cloud administrator settings](https://cloud.google.com/gemini/docs/admin-settings)
- [How Gemini for Google Cloud uses your data](https://cloud.google.com/gemini/docs/discover/data-governance)
- [Use the Gemini Code Assist agent mode](https://cloud.google.com/gemini/docs/codeassist/use-agentic-chat-pair-programmer)
- [Gemini Code Assist release notes](https://cloud.google.com/gemini/docs/codeassist/release-notes)

### Referencia comparativa ya utilizada

- [skills.sh `security-best-practices`](https://skills.sh/supercent-io/skills-template/security-best-practices)

---

## Anexo: Contexto externo de alto valor

Estas fuentes externas son recomendables si quieres reforzar la propuesta con evidencia tecnica, no solo con feature marketing de vendors.

### Reparacion automatizada de vulnerabilidades

- [A Case Study of LLM for Automated Vulnerability Repair: Assessing Impact of Reasoning and Patch Validation Feedback](https://arxiv.org/pdf/2405.15690)

Valor para este proyecto:

- refuerza la separacion entre triage y remediation
- justifica el uso de feedback de validacion
- apoya la idea de no confiar ciegamente en un patch generado en un solo paso

### Riesgo de degradacion tecnica en codigo generado

- [How and Why LLMs Use Deprecated APIs in Code](https://arxiv.org/pdf/2406.09834)

Valor para este proyecto:

- justifica el baseline corporativo para developers
- refuerza la necesidad de politicas y referencias actualizadas
- ayuda a argumentar que secure-by-default no se logra solo con prompting libre

### Benchmarks de capacidad de agentes

- [PaperBench](https://openai.com/research/paperbench/)
- [MLE-bench](https://openai.com/index/mle-bench/)
- [Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)

Valor para este proyecto:

- sirven para justificar por que un pipeline enterprise necesita contratos claros, evidencia y evaluacion reproducible
- ayudan a argumentar que capacidad del agente y gobernanza del agente son problemas distintos
- ayudan a justificar por que un perfil `pipeline` debe priorizar costo, contexto relevante y ejecucion por fases: cuando los agentes mejoran en tareas largas, el riesgo y el costo operativo de dejarlos actuar sin governance tambien aumenta

---

## Anexo: Uso recomendado de las fuentes en esta propuesta

### Usar fuentes oficiales para

- capacidades de seguridad y permisos
- analytics
- compliance
- remediation nativa
- limites documentados
- admin controls

### Usar fuentes externas para

- fundamentar decisiones de diseno
- justificar validacion de patches
- justificar separacion auto-fix vs human review
- justificar perfiles de costo y eficiencia

### No usar fuentes externas para

- reemplazar afirmaciones oficiales de producto
- inferir soporte enterprise no documentado
- atribuir capacidades no confirmadas a un vendor
