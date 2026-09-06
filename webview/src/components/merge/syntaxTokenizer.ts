import {
  BUILTINS,
  CONTROL_KEYWORDS,
  KEYWORDS,
  TYPE_KEYWORDS,
} from "./syntaxKeywords";
import { RULES } from "./syntaxRules";
import type { SyntaxToken, SyntaxTokenType } from "./syntaxTypes";

function tokenizeKeyValueLine(
  text: string,
  separator: ":" | "=",
): SyntaxToken[] | null {
  const match =
    separator === ":"
      ? text.match(/^(\s*)(["']?[\w.-]+["']?)(\s*:)(\s*)(.*)$/)
      : text.match(/^(\s*)([\w.-]+)(\s*=)(\s*)(.*)$/);
  if (!match) {
    return null;
  }
  // `!`: every capture group in both patterns is mandatory.
  const [, indent, key, sep, gap, value] = match;
  const tokens: SyntaxToken[] = [];
  let start = 0;
  const push = (part: string, type: SyntaxTokenType) => {
    if (part.length === 0) {
      return;
    }
    tokens.push({ value: part, type, start, end: start + part.length });
    start += part.length;
  };
  push(indent!, "plain");
  push(key!, "property");
  push(sep!, "operator");
  push(gap!, "plain");
  const valueTokens = tokenizeLine(value!);
  for (const token of valueTokens) {
    tokens.push({
      ...token,
      start: start + token.start,
      end: start + token.end,
    });
  }
  return tokens;
}

function tokenizeMarkupTag(text: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  let index = 0;
  const push = (value: string, type: SyntaxTokenType) => {
    if (value.length === 0) {
      return;
    }
    tokens.push({ value, type, start: index, end: index + value.length });
    index += value.length;
  };

  const open = text.startsWith("</") ? "</" : "<";
  push(open, "operator");
  const tag = text.slice(index).match(/^[A-Za-z][\w:.-]*/)?.[0];
  if (tag) {
    push(tag, "type");
  }

  while (index < text.length) {
    const rest = text.slice(index);
    const whitespace = rest.match(/^\s+/)?.[0];
    if (whitespace) {
      push(whitespace, "plain");
      continue;
    }
    const quoted = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[0];
    if (quoted) {
      push(quoted, "string");
      continue;
    }
    const attribute = rest.match(/^[:@#A-Za-z_][\w:.-]*/)?.[0];
    if (attribute) {
      push(attribute, "property");
      continue;
    }
    const punctuation = rest.match(/^(?:\/?>|=|\/)/)?.[0];
    if (punctuation) {
      push(punctuation, "operator");
      continue;
    }
    push(rest[0]!, "plain");
  }
  return tokens;
}

function tokenizeMarkupLine(text: string): SyntaxToken[] | null {
  if (!/[<>]/.test(text)) {
    return null;
  }
  const tokens: SyntaxToken[] = [];
  const markup = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = markup.exec(text)) !== null) {
    const start = match.index;
    if (start > cursor) {
      for (const token of tokenizeLine(text.slice(cursor, start))) {
        tokens.push({
          ...token,
          start: token.start + cursor,
          end: token.end + cursor,
        });
      }
    }
    const value = match[0];
    if (value.startsWith("<!--")) {
      tokens.push({
        value,
        type: "comment",
        start,
        end: start + value.length,
      });
    } else {
      for (const token of tokenizeMarkupTag(value)) {
        tokens.push({
          ...token,
          start: token.start + start,
          end: token.end + start,
        });
      }
    }
    cursor = start + value.length;
  }
  if (cursor < text.length) {
    for (const token of tokenizeLine(text.slice(cursor))) {
      tokens.push({
        ...token,
        start: token.start + cursor,
        end: token.end + cursor,
      });
    }
  }
  return tokens;
}

function tokenizeLanguageLine(
  text: string,
  language?: string,
): SyntaxToken[] | null {
  if (language === "html" || language === "xml" || language === "mdx") {
    return tokenizeMarkupLine(text);
  }
  if (language === "yaml") {
    if (/^\s*#/.test(text)) {
      return [{ value: text, type: "comment", start: 0, end: text.length }];
    }
    return tokenizeKeyValueLine(text, ":");
  }
  if (language === "json" || language === "jsonc") {
    const jsonProperty = text.match(
      /^(\s*)("[^"\\]*(?:\\.[^"\\]*)*")(\s*:)(.*)$/,
    );
    if (!jsonProperty) {
      return null;
    }
    // `!`: every capture group in the pattern is mandatory.
    const [, indent, key, sep, value] = jsonProperty;
    const tokens: SyntaxToken[] = [];
    let start = 0;
    const push = (part: string, type: SyntaxTokenType) => {
      if (part.length === 0) {
        return;
      }
      tokens.push({ value: part, type, start, end: start + part.length });
      start += part.length;
    };
    push(indent!, "plain");
    push(key!, "property");
    push(sep!, "operator");
    const valueTokens = tokenizeLine(value!);
    for (const token of valueTokens) {
      tokens.push({
        ...token,
        start: start + token.start,
        end: start + token.end,
      });
    }
    return tokens;
  }
  if (language === "shell") {
    return tokenizeKeyValueLine(text, "=");
  }
  return null;
}

// Tokenize a single line of code into typed tokens.
export function tokenizeLine(text: string, language?: string): SyntaxToken[] {
  const languageTokens = tokenizeLanguageLine(text, language);
  if (languageTokens) {
    return languageTokens;
  }

  const tokens: SyntaxToken[] = [];
  let rest = text;

  const push = (value: string, type: SyntaxTokenType, start: number) => {
    // Classify identifiers precisely
    if (type === "identifier") {
      if (CONTROL_KEYWORDS.has(value)) {
        type = "keyword2";
      } else if (KEYWORDS.has(value)) {
        type = "keyword";
      } else if (TYPE_KEYWORDS.has(value)) {
        type = "type";
      } else if (BUILTINS.has(value)) {
        type = "builtin";
      } else {
        type = "plain"; // generic identifier → plain (no highlight)
      }
    }

    // Merge adjacent plain tokens
    const last = tokens[tokens.length - 1];
    if (last && last.type === "plain" && type === "plain") {
      last.value += value;
      last.end = start + value.length;
    } else {
      tokens.push({ value, type, start, end: start + value.length });
    }
  };

  while (rest.length > 0) {
    let matched = false;
    for (const rule of RULES) {
      const m = rest.match(rule.regex);
      if (m) {
        push(m[0], rule.type, text.length - rest.length);
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // `!`: the loop only runs while `rest` is non-empty.
      push(rest[0]!, "plain", text.length - rest.length);
      rest = rest.slice(1);
    }
  }

  return tokens;
}
