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
      "webview/**/__tests__/**/*.test.ts",
      "webview/**/__tests__/**/*.test.tsx",
    ],
    benchmark: {
      include: ["src/**/__benchmarks__/**/*.bench.ts"],
    },
    // Integration tests run under a real VS Code host via mocha, not Vitest.
    exclude: ["src/test/**", "node_modules", "dist", "out", "webview/dist"],
    environment: "node",
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
        "src/webview/GitHistoryWebviewPanel.ts",
        "src/webview/gitViewPanelRouter.ts",

        "webview/**/__tests__/**",
      ],
      // Measured on 2026-08-29 over 426 files (260 test files, 1436 tests).
      // Every figure is floor(measured) - 2: the two-point margin stops a
      // one-line edit from turning CI red while still failing a real drop.
      // Ratchet upward as coverage improves; never lower one to land a change.
      //
      // Widening `include` to .tsx RAISED the global number (68.78 -> 70.89)
      // instead of dropping it — the .tsx components are better covered than
      // the logic layers they used to hide behind. Global `functions` is the
      // one figure that actually fell (78 -> 73.62), so it is the one
      // threshold that legitimately moved down. Everything else moved up.
      thresholds: {
        lines: 68,
        functions: 71,
        branches: 73,
        statements: 68,
        "src/core/**": {
          lines: 90,
          functions: 94,
          branches: 86,
          statements: 90,
        },
        "src/shared/**": {
          lines: 93,
          functions: 93,
          branches: 88,
          statements: 93,
        },
        // Low because src/webviewHost/handlers/** is exercised by the VS Code
        // integration and native e2e suites, which Vitest does not observe. The
        // floor exists to ratchet, not to certify.
        "src/webviewHost/**": {
          lines: 37,
          functions: 60,
          branches: 52,
          statements: 37,
        },
        "src/commands/**": {
          lines: 66,
          functions: 86,
          branches: 51,
          statements: 66,
        },
        "src/services/git/**": {
          lines: 76,
          functions: 86,
          branches: 71,
          statements: 76,
        },
        "src/services/review/**": {
          lines: 73,
          functions: 76,
          branches: 64,
          statements: 73,
        },
        "src/webview/**": {
          lines: 96,
          functions: 98,
          branches: 88,
          statements: 96,
        },
        "webview/src/lib/**": {
          lines: 86,
          functions: 90,
          branches: 77,
          statements: 86,
        },
        "webview/src/stores/**": {
          lines: 79,
          functions: 85,
          branches: 89,
          statements: 79,
        },
        "webview/src/apps/**": {
          lines: 44,
          functions: 31,
          branches: 66,
          statements: 44,
        },
        "webview/src/components/**": {
          lines: 79,
          functions: 62,
          branches: 76,
          statements: 79,
        },
        "webview/src/hooks/**": {
          lines: 61,
          functions: 85,
          branches: 65,
          statements: 61,
        },
        "webview/src/screens/**": {
          lines: 85,
          functions: 64,
          branches: 74,
          statements: 85,
        },
      },
    },
  },
});
