// Lightweight Monaco loader — all monaco-editor imports are dynamic so the merge
// app can boot inside VS Code webviews (strict CSP) before Monaco is needed.
import type * as Monaco from "monaco-editor/editor";

let monacoPromise: Promise<typeof Monaco> | null = null;
let monacoLoaded: typeof Monaco | null = null;
const languagePromises = new Map<string, Promise<unknown>>();

type LanguageDefinition = {
  conf?: Monaco.languages.LanguageConfiguration;
  language?: Monaco.languages.IMonarchLanguage;
};

const languageContributions: Record<string, () => Promise<unknown>> = {
  javascript: () => import("monaco-editor/languages/definitions/javascript/register"),
  typescript: () => import("monaco-editor/languages/definitions/typescript/register"),
  python: () => import("monaco-editor/languages/definitions/python/register"),
  rust: () => import("monaco-editor/languages/definitions/rust/register"),
  go: () => import("monaco-editor/languages/definitions/go/register"),
  css: () => import("monaco-editor/languages/definitions/css/register"),
  scss: () => import("monaco-editor/languages/definitions/scss/register"),
  less: () => import("monaco-editor/languages/definitions/less/register"),
  // HTML's Monarch grammar delegates `<script>`/`<style>` blocks to embedded
  // language ids. Register those definitions before the first HTML model is
  // created so Vue/Svelte files do not render their script body as plaintext.
  html: () =>
    Promise.all([
      import("monaco-editor/languages/definitions/html/register"),
      import("monaco-editor/languages/definitions/javascript/register"),
      import("monaco-editor/languages/definitions/typescript/register"),
      import("monaco-editor/languages/definitions/css/register"),
    ]),
  mdx: () => import("monaco-editor/languages/definitions/mdx/register"),
  yaml: () => import("monaco-editor/languages/definitions/yaml/register"),
  markdown: () => import("monaco-editor/languages/definitions/markdown/register"),
  shell: () => import("monaco-editor/languages/definitions/shell/register"),
  powershell: () => import("monaco-editor/languages/definitions/powershell/register"),
  bat: () => import("monaco-editor/languages/definitions/bat/register"),
  cpp: () => import("monaco-editor/languages/definitions/cpp/register"),
  java: () => import("monaco-editor/languages/definitions/java/register"),
  kotlin: () => import("monaco-editor/languages/definitions/kotlin/register"),
  swift: () => import("monaco-editor/languages/definitions/swift/register"),
  dart: () => import("monaco-editor/languages/definitions/dart/register"),
  php: () => import("monaco-editor/languages/definitions/php/register"),
  ruby: () => import("monaco-editor/languages/definitions/ruby/register"),
  csharp: () => import("monaco-editor/languages/definitions/csharp/register"),
  sql: () => import("monaco-editor/languages/definitions/sql/register"),
  xml: () => import("monaco-editor/languages/definitions/xml/register"),
  ini: () => import("monaco-editor/languages/definitions/ini/register"),
  dockerfile: () => import("monaco-editor/languages/definitions/dockerfile/register"),
  graphql: () => import("monaco-editor/languages/definitions/graphql/register"),
  handlebars: () => import("monaco-editor/languages/definitions/handlebars/register"),
  hcl: () => import("monaco-editor/languages/definitions/hcl/register"),
  protobuf: () => import("monaco-editor/languages/definitions/protobuf/register"),
  pug: () => import("monaco-editor/languages/definitions/pug/register"),
  coffee: () => import("monaco-editor/languages/definitions/coffee/register"),
  lua: () => import("monaco-editor/languages/definitions/lua/register"),
  r: () => import("monaco-editor/languages/definitions/r/register"),
  scala: () => import("monaco-editor/languages/definitions/scala/register"),
  solidity: () => import("monaco-editor/languages/definitions/solidity/register"),
  systemverilog: () =>
    import("monaco-editor/languages/definitions/systemverilog/register"),
  fsharp: () => import("monaco-editor/languages/definitions/fsharp/register"),
  julia: () => import("monaco-editor/languages/definitions/julia/register"),
  tcl: () => import("monaco-editor/languages/definitions/tcl/register"),
  vb: () => import("monaco-editor/languages/definitions/vb/register"),
  "objective-c": () =>
    import("monaco-editor/languages/definitions/objective-c/register"),
  // Tokenizer only — `languages/features/json` is a language service and
  // emits json.worker (~400 kB) plus extra Monaco UI into the asset budget.
  json: () =>
    (monacoPromise ?? Promise.reject(new Error("Monaco is not loading"))).then(
      (monaco) =>
        import("./registerJsonMonarch").then(({ registerJsonMonarch }) => {
          registerJsonMonarch(monaco);
        }),
    ),
};

// `definitions/*/register` installs a lazy provider factory. That factory is
// normally loaded after the first model is created, which leaves the first
// GitView paint in plaintext. Import the definitions themselves as part of
// the language gate and bind them to the exact API object used by our editor.
// This also keeps embedded HTML languages (Vue/Svelte/Astro) ready before
// their parent model is tokenized.
const languageDefinitions: Record<string, () => Promise<unknown>> = {
  javascript: () => import("monaco-editor/languages/definitions/javascript/javascript"),
  typescript: () => import("monaco-editor/languages/definitions/typescript/typescript"),
  python: () => import("monaco-editor/languages/definitions/python/python"),
  rust: () => import("monaco-editor/languages/definitions/rust/rust"),
  go: () => import("monaco-editor/languages/definitions/go/go"),
  css: () => import("monaco-editor/languages/definitions/css/css"),
  scss: () => import("monaco-editor/languages/definitions/scss/scss"),
  less: () => import("monaco-editor/languages/definitions/less/less"),
  html: () => import("monaco-editor/languages/definitions/html/html"),
  mdx: () => import("monaco-editor/languages/definitions/mdx/mdx"),
  yaml: () => import("monaco-editor/languages/definitions/yaml/yaml"),
  markdown: () => import("monaco-editor/languages/definitions/markdown/markdown"),
  shell: () => import("monaco-editor/languages/definitions/shell/shell"),
  powershell: () => import("monaco-editor/languages/definitions/powershell/powershell"),
  bat: () => import("monaco-editor/languages/definitions/bat/bat"),
  cpp: () => import("monaco-editor/languages/definitions/cpp/cpp"),
  java: () => import("monaco-editor/languages/definitions/java/java"),
  kotlin: () => import("monaco-editor/languages/definitions/kotlin/kotlin"),
  swift: () => import("monaco-editor/languages/definitions/swift/swift"),
  dart: () => import("monaco-editor/languages/definitions/dart/dart"),
  php: () => import("monaco-editor/languages/definitions/php/php"),
  ruby: () => import("monaco-editor/languages/definitions/ruby/ruby"),
  csharp: () => import("monaco-editor/languages/definitions/csharp/csharp"),
  sql: () => import("monaco-editor/languages/definitions/sql/sql"),
  xml: () => import("monaco-editor/languages/definitions/xml/xml"),
  ini: () => import("monaco-editor/languages/definitions/ini/ini"),
  dockerfile: () => import("monaco-editor/languages/definitions/dockerfile/dockerfile"),
  graphql: () => import("monaco-editor/languages/definitions/graphql/graphql"),
  handlebars: () => import("monaco-editor/languages/definitions/handlebars/handlebars"),
  hcl: () => import("monaco-editor/languages/definitions/hcl/hcl"),
  protobuf: () => import("monaco-editor/languages/definitions/protobuf/protobuf"),
  pug: () => import("monaco-editor/languages/definitions/pug/pug"),
  coffee: () => import("monaco-editor/languages/definitions/coffee/coffee"),
  lua: () => import("monaco-editor/languages/definitions/lua/lua"),
  r: () => import("monaco-editor/languages/definitions/r/r"),
  scala: () => import("monaco-editor/languages/definitions/scala/scala"),
  solidity: () => import("monaco-editor/languages/definitions/solidity/solidity"),
  systemverilog: () => import("monaco-editor/languages/definitions/systemverilog/systemverilog"),
  fsharp: () => import("monaco-editor/languages/definitions/fsharp/fsharp"),
  julia: () => import("monaco-editor/languages/definitions/julia/julia"),
  tcl: () => import("monaco-editor/languages/definitions/tcl/tcl"),
  vb: () => import("monaco-editor/languages/definitions/vb/vb"),
  "objective-c": () => import("monaco-editor/languages/definitions/objective-c/objective-c"),
};

const languageDefinitionDependencies: Record<string, readonly string[]> = {
  html: ["html", "javascript", "typescript", "css"],
};

async function loadLanguageContribution(
  monaco: typeof Monaco,
  language?: string,
): Promise<void> {
  if (!language) {
    return;
  }
  const load = languageContributions[language];
  if (!load) {
    return;
  }
  const existing = languagePromises.get(language);
  if (existing) {
    await existing;
    return;
  }
  const pending = (async () => {
    await load();
    const definitionIds = languageDefinitionDependencies[language] ?? [language];
    await Promise.all(
      definitionIds.map(async (definitionId) => {
        const definitionLoader = languageDefinitions[definitionId];
        if (!definitionLoader) {
          return;
        }
        const definition = (await definitionLoader()) as LanguageDefinition;
        if (definition.language) {
          monaco.languages.setMonarchTokensProvider(
            definitionId,
            definition.language,
          );
        }
        if (definition.conf) {
          monaco.languages.setLanguageConfiguration(definitionId, definition.conf);
        }
      }),
    );
  })();
  languagePromises.set(language, pending);
  await pending;
}

export function getMonacoIfLoaded(): typeof Monaco | null {
  return monacoLoaded;
}

export async function loadMonaco(language?: string): Promise<typeof Monaco> {
  if (!monacoPromise) {
    monacoPromise = (async () => {
      const { configureMonacoEnvironment } = await import("./monacoEnvironment");
      configureMonacoEnvironment();
      const [api] = await Promise.all([
        import("monaco-editor/editor"),
        import("monaco-editor/features/diffEditor/register"),
      ]);
      monacoLoaded = api;
      return api;
    })();
  }
  const api = await (monacoLoaded ? Promise.resolve(monacoLoaded) : monacoPromise);
  await loadLanguageContribution(api, language);
  return api;
}
