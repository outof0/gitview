import type * as Monaco from "monaco-editor/editor";

/**
 * Monarch tokenizer for JSON. Monaco's `languages/features/json` package is a
 * full language service (schema, diagnostics, worker) and emits ~400 kB of
 * `json.worker` into the webview assets even though `monacoEnvironment` noops
 * workers. Highlighting is all the diff/merge editors need.
 */
const language: Monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".json",
  tokenizer: {
    root: [
      [/{/, "delimiter.bracket"],
      [/}/, "delimiter.bracket"],
      [/\[/, "delimiter.array"],
      [/\]/, "delimiter.array"],
      [/,/, "delimiter.comma"],
      [/:/, "delimiter.colon"],
      [/"([^"\\]|\\.)*"(?=\s*:)/, "string.key"],
      [/"([^"\\]|\\.)*"/, "string.value"],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
      [/\b(?:true|false|null)\b/, "keyword"],
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
    ],
    comment: [
      [/[^*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/\*/, "comment"],
    ],
  },
};

const configuration: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: '"', close: '"' },
  ],
};

export function registerJsonMonarch(monaco: typeof Monaco): void {
  monaco.languages.register({
    id: "json",
    extensions: [".json", ".jsonc", ".json5"],
    aliases: ["JSON", "json"],
    mimetypes: ["application/json"],
  });
  monaco.languages.setLanguageConfiguration("json", configuration);
  monaco.languages.setMonarchTokensProvider("json", language);
}
