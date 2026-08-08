import type { SyntaxTokenType } from "./syntaxTypes";

type Rule = {
  type: SyntaxTokenType;
  regex: RegExp;
};

// Anchored rules consumed left-to-right; first match wins.
export const RULES: Rule[] = [
  // Block comments
  { type: "comment", regex: /^(\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/ },
  // Single-line comments (// # --)
  { type: "comment", regex: /^(\/\/.*|#.*|--.*)/ },
  // Template literals (backtick)
  { type: "template", regex: /^(`(?:\\.|[^\\`])*`)/ },
  // Strings: single, double, triple-double (Python), triple-single (Python)
  {
    type: "string",
    regex: /^("""[\s\S]*?"""|'''[\s\S]*?'''|(['"`])(?:\\.|(?!\2)[^\\])*\2)/,
  },
  // Decorators / annotations: @Foo, #[attr]
  { type: "decorator", regex: /^(@[a-zA-Z_][a-zA-Z0-9_]*)/ },
  { type: "decorator", regex: /^(#\[[^\]]*\])/ },
  // Numbers (hex, float, int, binary, octal, with optional suffix)
  {
    type: "number",
    regex:
      /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*\.[\d_]*(?:[eE][+-]?\d+)?[fF]?|\.[\d_]+(?:[eE][+-]?\d+)?[fF]?|\d[\d_]*(?:[eE][+-]?\d+)?[uUlLfF]*)/,
  },
  // Identifiers: matched then classified
  {
    type: "identifier",
    regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/,
  },
  // Operators & punctuation (just to tokenize them; rendered as plain unless we add a class)
  {
    type: "operator",
    regex: /^(?:=>|->|::|\.\.\.|\.\.|[=!<>]=?|&&|\|\||[+\-*/%&|^~!?:,.;])/,
  },
  // Whitespace and anything else
  { type: "plain", regex: /^\s+/ },
  { type: "plain", regex: /^./ },
];