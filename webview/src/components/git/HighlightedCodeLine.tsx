import { memo } from "react";
import { detectLanguage, syntaxClass, tokenizeLine } from "../merge/syntax";

type HighlightedCodeLineProps = {
  text: string;
  /** Repo-relative path — drives syntax token classes and E2E language checks. */
  filePath?: string | null;
};

function fallbackTokens(text: string, language?: string) {
  return tokenizeLine(text, language).map((tok, i) => {
    const cls = syntaxClass(tok.type);
    return cls ? (
      <span key={i} className={cls}>
        {tok.value}
      </span>
    ) : (
      <span key={i}>{tok.value}</span>
    );
  });
}

/** Lightweight syntax highlighting for list-based previews; full editors use Monaco. */
export const HighlightedCodeLine = memo(function HighlightedCodeLine({
  text,
  filePath,
}: HighlightedCodeLineProps) {
  const language = filePath ? detectLanguage(filePath) : undefined;
  const codeClass =
    "nx-code-line inline font-inherit whitespace-pre bg-transparent";

  if (text === "") {
    return (
      <code
        className={codeClass}
        data-testid="code-line"
        data-language={language}
      >
        {" "}
      </code>
    );
  }

  return (
    <code
      className={codeClass}
      data-testid="code-line"
      data-language={language}
    >
      {fallbackTokens(text, language)}
    </code>
  );
});
