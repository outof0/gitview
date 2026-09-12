declare module "monaco-editor/languages/definitions/*" {
  import type * as Monaco from "monaco-editor/editor";

  export const conf: Monaco.languages.LanguageConfiguration;
  export const language: Monaco.languages.IMonarchLanguage;
}
