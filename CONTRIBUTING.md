# Contributing

Thank you for your interest in improving security practices for AI coding agents! 🔒

## How You Can Contribute

### 1. Add Security Rules

Create a new rule in `AGENT_RULES.md` or a new policy in `policies/`:

- Rules must reference at least one standard (OWASP, CWE, NIST, SLSA)
- Include ✅ (do) and ❌ (don't) examples
- Be language-agnostic unless in a language-specific folder

### 2. Add or Improve Policy Files

Policy files in `policies/` are YAML-structured rulesets. Each policy should:

- Have a clear `name` and `version`
- Map rules to standards (CWE ID, ASVS chapter, etc.)
- Include actionable prevention guidance

### 3. Add Agent Setup Instructions

Help us cover more agents! Add setup instructions to `README.md`:

- Exact file to create and where
- Content to paste (copy-paste ready)
- IDE-specific settings if applicable
- Test that it actually works with the agent

### 4. Report Issues

- Rules that are incorrect or outdated
- Standards that have been updated
- Agents with new configuration methods
- Missing prevention advice for a CWE

## Standards We Follow

Every rule must be traceable to at least one of:

| Standard | How to reference |
|----------|-----------------|
| OWASP ASVS 5.0.0 | `(ASVS V5.1)` |
| OWASP MASVS 2.1.0 | `(MASVS-CRYPTO)` |
| CWE/SANS Top 25 | `(CWE-79)` |
| NIST SP 800-218 | `(NIST SSDF PW.5)` |
| NIST SP 800-53 | `(NIST AU-3)` |
| OWASP LLM Top 10 | `(LLM01)` |
| SLSA | `(SLSA L1)` |

## Pull Request Process

1. Fork the repository
2. Create a branch: `feat/add-python-rules` or `fix/update-cwe-table`
3. Make your changes
4. Ensure YAML files are valid: `python -c "import yaml; yaml.safe_load(open('policies/your_file.yaml'))"`
5. Submit a PR with:
   - What standard(s) the change references
   - Why the change improves security guidance
   - Which agents you tested it with (if applicable)

## Style Guide

- Use simple, direct language — agents parse these literally
- Prefer ✅/❌ bullet format for rules
- Keep lines short — agents have context limits
- Map every rule to a CWE, ASVS chapter, or NIST control
- No marketing language — be technical and precise

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
