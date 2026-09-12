import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@gitview/types": path.resolve(__dirname, "src/types/index.ts"),
      "@gitview/shared": path.resolve(__dirname, "src/shared"),
    },
  },
  // Use esbuild's automatic JSX runtime so .tsx component tests work without a
  // dedicated React plugin (kept out of root deps on purpose). React 18 is a
  // root devDependency so it resolves consistently with the webview.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // Git integration tests share a conflict fixture and temp repos; avoid
    // parallel file runs racing on fixture rebuild/copy.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Monaco and other browser APIs need small polyfills in jsdom tests.
    setupFiles: ["./vitest.setup.ts"],
    // Host/core tests are .ts; webview component tests are .tsx. Component tests
    // opt into jsdom via a `// @vitest-environment jsdom` docblock at the top of
    // the file; everything else stays on the fast node environment.
    include: [
      "src/**/*.test.ts",
      // Release and CI scripts are plain ESM; their guards are unit-tested
      // against throwaway Git repositories.
      "scripts/**/__tests__/**/*.test.mjs",
      "webview/**/__tests__/**/*.test.ts",
      "webview/**/__tests__/**/*.test.tsx",
    ],
    benchmark: {
      include: ["src/**/__benchmarks__/**/*.bench.ts"],
    },
    // Integration tests run under a real VS Code host via mocha, not Vitest.
    exclude: ["src/test/**", "node_modules", "dist", "out", "webview/dist"],
    environment: "node",
    environmentOptions: {
      jsdom: {
        url: "http://localhost",
      },
    },
    coverage: {
      provider: "v8",
      // Report files no test imports as 0% instead of dropping them from the
      // report. Without this, deleting every test for a module makes its
      // coverage disappear rather than fall.
      all: true,
      // The measured set is the whole of src/ plus the webview's stores, hooks,
      // lib, apps, components and screens — UI included. The six `.ts`
      // helpers under webview/src/components that used to be hand-listed here
      // (rows.ts, syntax.ts, centerDocument.ts, …) are now covered by the glob
      // like everything else; hand-picking them hid 22 files / 1,850 lines
      // from the gate.
      include: [
        "src/core/**/*.ts",
        "src/shared/**/*.ts",
        "src/webview/**/*.ts",
        "src/webviewHost/**/*.ts",
        "src/commands/**/*.ts",
        "src/services/**/*.ts",
        "src/util/**/*.ts",
        "src/config/**/*.ts",
        "webview/src/stores/**/*.ts",
        "webview/src/hooks/**/*.ts",
        "webview/src/lib/**/*.ts",
        "webview/src/apps/**/*.ts",
        "webview/src/apps/**/*.tsx",
        "webview/src/components/**/*.ts",
        "webview/src/components/**/*.tsx",
        "webview/src/screens/**/*.tsx",
      ],
      exclude: [
        "src/**/__tests__/**",
        "src/**/__benchmarks__/**",
        // VS Code webview host glue is covered by extension-host integration and
        // native e2e tests; Vitest coverage tracks pure helpers/parsers instead.
        "src/webview/GitWorkspaceViewProvider.ts",
        "src/webview/gitWorkspacePanel.ts",
        "src/webview/gitViewPresentation.ts",
        "src/webview/GitViewPanel.ts",
        "src/webview/gitViewPanelRouter.ts",

        "webview/**/__tests__/**",
      ],
      // Vitest 4's V8 provider uses AST remapping. Baseline re-measured on
      // 2026-09-10 over the configured suite (304 files / 1,906 tests), after
      // the hand-picked excludes above were trimmed so 22 files / 1,850 lines
      // rejoin the gate. The statement and line floors rose (63 → 68); the
      // function and branch floors fell (78 → 70 and 72 → 63) because AST
      // remapping counts more, smaller units. These are integer floors of that
      // baseline, not a target.
      //
      // Follow-up target: record the measured value beside each floor on the
      // next `pnpm run test:coverage` and raise the floor whenever it moves.
      // The pre-migration 78 / 72 are not the target — they measured a
      // different denominator.
      thresholds: {
        lines: 68,
        functions: 70,
        branches: 63,
        statements: 68,
        "src/core/**": {
          lines: 92,
          functions: 98,
          branches: 87,
          statements: 92,
        },
        "src/shared/**": {
          lines: 89,
          functions: 93,
          branches: 86,
          statements: 89,
        },
        // Low because src/webviewHost/handlers/** is exercised by the VS Code
        // integration and native e2e suites, which Vitest does not observe. The
        // floor exists to ratchet, not to certify.
        "src/webviewHost/**": {
          // Current floor is 37.88% lines / 37.88% statements; target 38% after
          // the newly covered refresh/error paths are extended to the handlers.
          lines: 37,
          functions: 61,
          branches: 33,
          statements: 37,
        },
        "src/commands/**": {
          lines: 63,
          functions: 90,
          branches: 54,
          statements: 63,
        },
        "src/services/git/**": {
          lines: 81,
          functions: 88,
          branches: 67,
          statements: 81,
        },
        "src/services/review/**": {
          lines: 74,
          functions: 76,
          branches: 63,
          statements: 74,
        },
        "src/webview/**": {
          lines: 97,
          functions: 100,
          branches: 92,
          statements: 97,
        },
        "webview/src/lib/**": {
          lines: 85,
          functions: 96,
          branches: 73,
          statements: 85,
        },
        "webview/src/stores/**": {
          lines: 77,
          functions: 85,
          branches: 71,
          statements: 77,
        },
        "webview/src/apps/**": {
          lines: 45,
          functions: 33,
          branches: 41,
          statements: 45,
        },
        "webview/src/components/**": {
          lines: 75,
          functions: 68,
          branches: 71,
          statements: 75,
        },
        "webview/src/hooks/**": {
          lines: 61,
          functions: 77,
          branches: 45,
          statements: 61,
        },
        "webview/src/screens/**": {
          // Current floor is 79.73% lines after the history screen changes;
          // target 80% once the new empty/error branches gain focused tests.
          lines: 79,
          functions: 75,
          branches: 74,
          statements: 80,
        },
      },
    },
  },
});
