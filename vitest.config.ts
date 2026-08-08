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
    exclude: [
      "src/test/**",
      "node_modules",
      "dist",
      "out",
      "webview/dist",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
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
        "webview/src/hooks/merge/**/*.ts",
        "webview/src/lib/**/*.ts",
        "webview/src/components/merge/rows.ts",
        "webview/src/components/merge/rowHighlight.ts",
        "webview/src/components/merge/syntax.ts",
        "webview/src/components/merge/wordDiff.ts",
        "webview/src/components/git/changedFilesTree.ts",
        "webview/src/components/git/gitPanelFormat.ts",
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
        "webview/**/screens/**",
        "webview/**/*.tsx",
      ],
      thresholds: {
        // The global numbers dropped when src/shared and src/webviewHost were
        // added to `include`: the protocol and the message router had been
        // outside the measured set entirely. Widened scope, not a regression.
        lines: 63,
        functions: 78,
        branches: 72,
        statements: 63,
        "src/shared/**": {
          lines: 88,
          functions: 92,
          branches: 78,
          statements: 88,
        },
        // Low because src/webviewHost/handlers/** is exercised by the VS Code
        // integration and native e2e suites, which Vitest does not observe. The
        // floor exists to ratchet, not to certify.
        "src/webviewHost/**": {
          lines: 33,
          functions: 55,
          branches: 50,
          statements: 33,
        },
        "src/commands/**": {
          lines: 25,
          functions: 20,
          branches: 20,
          statements: 25,
        },
        "src/services/git/**": {
          lines: 45,
          functions: 45,
          branches: 40,
          statements: 45,
        },
        "src/webview/**": {
          lines: 65,
          functions: 65,
          branches: 60,
          statements: 65,
        },
        "webview/src/lib/**": {
          lines: 45,
          functions: 45,
          branches: 40,
          statements: 45,
        },
        "webview/src/stores/**": {
          lines: 40,
          functions: 40,
          branches: 35,
          statements: 40,
        },
      },
    },
  },
});
