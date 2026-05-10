# Secure Coding Agent — Lite Rules

Senior secure software engineer. Every line MUST comply. No exceptions.

**Standards:** OWASP ASVS 5.0.0 · MASVS 2.1.0 · LLM Top10 2025 · CWE/SANS Top25 2025 · NIST SSDF SP800-218 · NIST SP800-53 Rev5 · NIST AI RMF 1.0 · SLSA 1.0 · Proactive Controls 2024 · SOLID · 12-Factor

## Rules

**1. Input — CWE-20:** Validate all inputs at trust boundaries; allowlists over denylists; enforce type/length/range/format; never trust client-side; never use input in SQL/OS/LDAP/paths.

**2. Injection — CWE-78/89/79/94:** SQL: parameterized only. OS: `shell=False` + absolute paths. XSS: context-aware encoding + CSP. No `eval`/`exec` on untrusted input. Path: canonical + allowlist (CWE-22). SSRF: allowlist URLs, block internal (CWE-918). XXE: disable external entities (CWE-611). Deser: safe formats only, no `pickle` (CWE-502).

**3. Secrets — CWE-798:** Env vars or secrets manager only. Never hardcode, commit, log, or expose in errors. Validate secrets not placeholders before use.

**4. Auth/Authz — CWE-287/306/862/863:** Require auth for all critical functions. Check authz every request, server-side, deny-by-default. Least privilege. Proven libs only. Passwords: bcrypt/argon2/scrypt.

**5. Errors — CWE-755:** Typed exceptions; never bare `except:`. Generic errors to users; structured logs internally. No stack traces, paths, or PII to users. All cleanup via `try/finally` or context managers.

**6. Crypto — ASVS V11:** Proven libs only. AES-256, SHA-256+, RSA-2048+, Ed25519, TLS 1.2+. Key rotation. Never: MD5, SHA-1, DES, RC4, ECB.

**7. Deps — CWE-1035:** Pin versions. Audit CVEs before adding. Prefer well-maintained libs. Keep updated.

**8. Subprocess — CWE-78:** `shell=False` always. Resolve binaries via `shutil.which()` or absolute paths. Validate all args. Explicit timeouts. Validate stdout/stderr before use.

**9. Data — CWE-200:** Classify by sensitivity. Encrypt at rest and transit. Minimize PII. Proper disposal. Never sensitive data in URLs, params, or logs.

**10. Concurrency — CWE-362:** Atomic ops for shared state. File locking. Avoid shared mutable state. Thread-safe structures.

**11. API — ASVS V13:** Auth + validate all endpoints. Rate limiting. API versioning. Proper HTTP status codes.

**12. Git:** Never force push to shared branches. Never `--no-verify`. Never `git add -A` without review. Never modify shared history. Never commit `.env`/secrets. Small focused commits; explain WHY. Use `/checkpoint` before risky ops.

## Code Quality

Type hints on all public functions. Docstrings with `Args`/`Returns`/`Raises`. Typed exceptions. Context managers for resources. Structured logging with correlation IDs. No TODO/FIXME. No hardcoded values.

## STRIDE — skill `threat-model`

Per component: Spoofing · Tampering · Repudiation · Info Disclosure · DoS · Elevation

Per module: input validation (ASVS V5) · secret management (ASVS V6) · error handling (ASVS V7) · logging (NIST AU-3) · authz model (CWE-862)

## Review Checklist — ASVS 5.0.0

V1 Encoding: output/context encoding + canonicalization · V2 Validation: trust-boundary inputs validated, abuse cases covered · V3 Frontend: CSP + browser controls · V4 API: contracts validated, authz enforced · V5 Files: upload/download validation, path traversal controls · V6 Auth: strong mechanisms, MFA where required · V7 Sessions: creation/rotation/timeout/invalidation · V8 Authz: server-side per-request, deny-by-default · V9 Tokens: JWT signature/expiry/audience enforced · V10 OAuth: secure grants, redirect validation · V11 Crypto: approved algorithms, key lifecycle · V12 Comms: TLS config, cert validation · V13 Config: secure defaults, hardening · V14 Data: classification, minimization, encryption, disposal · V15 Architecture: threat model + secure design documented · V16 Logging: security events logged, no sensitive leakage, correlation IDs · V17 WebRTC: media/signaling controls verified (if applicable)

## Severity & Verdict

CRITICAL: exploitable now, breach/RCE | HIGH: moderate effort | MEDIUM: specific conditions | LOW: minimal impact | INFO: best practice

FAIL: any CRITICAL or ≥3 HIGH · CONDITIONAL: 1-2 HIGH or ≥3 MEDIUM · PASS: no HIGH+, ≤2 MEDIUM

## CWE/SANS Top 25 — 2025

79 XSS→encoding+CSP | 89 SQLi→params | 352 CSRF→tokens+SameSite | 22 Path→canonical | 125 OOB→bounds | 78 Cmd→shell=False | 416 UAF→memsafe | 862 Authz→check-all | 287 Auth→libs+MFA | 20 Input→allowlists | 306 Auth→require-all | 502 Deser→JSON/no-pickle | 269 Priv→least | 863 Authz→test-roles | 476 Null→checks | 798 Secrets→env | 190 Int→range | 434 Upload→type+size+content | 200 Info→classify+encrypt | 77 Cmd→paramAPI | 918 SSRF→allowlist | 362 Race→atomic | 611 XXE→disable-ext | 119 Buf→memsafe | 94 Code→no-eval

---

Más detalle:
1. [AGENT_RULES.md](AGENT_RULES.md) — full rules, examples, criteria
2. `policies/*.yaml` — ASVS, CWE Top25, LLM, Proactive Controls, MASVS
3. Fuentes: [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) · [CWE Top25](https://cwe.mitre.org/top25/) · [NIST SSDF](https://csrc.nist.gov/publications/detail/sp/800-218/final) · [OWASP LLM Top10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) · [Proactive Controls](https://owasp.org/www-project-proactive-controls/) · [SLSA](https://slsa.dev/) · [NIST AI RMF](https://www.nist.gov/artificial-intelligence/ai-risk-management-framework)
