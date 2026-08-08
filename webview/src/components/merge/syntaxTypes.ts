export type SyntaxTokenType =
  | "keyword"
  | "keyword2" // control-flow (return, break, continue, yield, await…)
  | "type" // type-level keywords (interface, type, enum, struct…)
  | "builtin" // built-in identifiers (console, print, len, self, this…)
  | "string"
  | "template" // template literal / f-string
  | "comment"
  | "number"
  | "operator" // punctuation-level operators
  | "decorator" // @Decorator / #[attr]
  | "property" // object/YAML keys
  | "variable" // shell/env-style variables
  | "identifier" // generic identifier (no class)
  | "plain";

export type SyntaxToken = {
  value: string;
  type: SyntaxTokenType;
  start: number;
  end: number;
};