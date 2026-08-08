// Lightweight Monaco loader — all monaco-editor imports are dynamic so the merge
// app can boot inside VS Code webviews (strict CSP) before Monaco is needed.
import type * as Monaco from "monaco-editor/editor";

let monacoPromise: Promise<typeof Monaco> | null = null;
let monacoLoaded: typeof Monaco | null = null;

async function importMonacoContributions(): Promise<void> {
  await Promise.all([
    // Side-by-side compare (Git Compare / history diff)
    import("monaco-editor/features/diffEditor/register"),
    import("monaco-editor/languages/definitions/javascript/register"),
    import("monaco-editor/languages/definitions/typescript/register"),
    import("monaco-editor/languages/definitions/python/register"),
    import("monaco-editor/languages/definitions/rust/register"),
    import("monaco-editor/languages/definitions/go/register"),
    import("monaco-editor/languages/definitions/css/register"),
    import("monaco-editor/languages/definitions/scss/register"),
    import("monaco-editor/languages/definitions/less/register"),
    import("monaco-editor/languages/definitions/html/register"),
    import("monaco-editor/languages/definitions/yaml/register"),
    import("monaco-editor/languages/definitions/markdown/register"),
    import("monaco-editor/languages/definitions/shell/register"),
    import("monaco-editor/languages/definitions/cpp/register"),
    import("monaco-editor/languages/definitions/java/register"),
    import("monaco-editor/languages/definitions/kotlin/register"),
    import("monaco-editor/languages/definitions/swift/register"),
    import("monaco-editor/languages/definitions/dart/register"),
    import("monaco-editor/languages/definitions/php/register"),
    import("monaco-editor/languages/definitions/ruby/register"),
    import("monaco-editor/languages/definitions/csharp/register"),
    import("monaco-editor/languages/definitions/sql/register"),
    import("monaco-editor/languages/definitions/xml/register"),
    import("monaco-editor/languages/definitions/ini/register"),
    import("monaco-editor/languages/definitions/dockerfile/register"),
    import("monaco-editor/languages/features/json/register.js"),
  ]);
}

export function getMonacoIfLoaded(): typeof Monaco | null {
  return monacoLoaded;
}

export function loadMonaco(): Promise<typeof Monaco> {
  if (monacoLoaded) {
    return Promise.resolve(monacoLoaded);
  }
  if (!monacoPromise) {
    monacoPromise = (async () => {
      const { configureMonacoEnvironment } = await import("./monacoEnvironment");
      configureMonacoEnvironment();
      await importMonacoContributions();
      const api = await import("monaco-editor/editor");
      monacoLoaded = api;
      return api;
    })();
  }
  return monacoPromise;
}
