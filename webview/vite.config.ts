import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function stripCrossoriginForWebview() {
  return {
    name: "strip-crossorigin-for-webview",
    transformIndexHtml(html: string) {
      return html
        .replace(/\s+crossorigin(?:="[^"]*")?/g, "")
        .replace(/<link rel="modulepreload"[^>]*>\s*/g, "");
    },
  };
}

export default defineConfig({
  // Relative asset URLs so Vite lazy chunks resolve inside vscode-webview://.
  base: "./",
  plugins: [react(), stripCrossoriginForWebview()],
  resolve: {
    alias: {
      "@gitview/types": path.resolve(__dirname, "../src/types/index.ts"),
      "@gitview/shared": path.resolve(__dirname, "../src/shared"),
    },
  },
  root: ".",
  worker: {
    format: "es",
  },
  build: {
    modulePreload: false,
    outDir: "dist",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        manualChunks(id) {
          if (!id.includes("monaco-editor")) {
            return;
          }
          // Monaco already defers each grammar: `languages/definitions/<lang>/
          // register.js` only registers metadata and hands Monaco a lazy
          // `loader`. Funnelling every monaco module into one chunk defeats that
          // and downloads all 24 grammars to diff a `.txt` file. One chunk per
          // grammar restores it; the rest of Monaco stays in `monacoSetup`.
          const grammar = id
            .replace(/\\/g, "/")
            .match(/monaco-editor\/esm\/vs\/languages\/definitions\/([^/]+)\//);
          return grammar ? `monaco-lang-${grammar[1]}` : "monacoSetup";
        },
      },
    },
  },
  // Only hardcode production in the build (not dev) so import.meta.env.DEV works
  // during `vite` dev server for standalone browser debugging.
});
