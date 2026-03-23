import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/__tests__/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/__tests__/**"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
                // Per-file overrides for entry-point modules that cannot be unit-tested:
                // cli.ts — main() auto-runs; interactive paths require spawning a process
                // logger.ts — supportsColor() evaluated at module load; not re-evaluable in unit tests
                perFile: false,
            },
        },
    },
});
